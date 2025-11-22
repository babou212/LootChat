package com.lootchat.LootChat.service;

import io.minio.*;
import io.minio.http.Method;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import jakarta.annotation.PostConstruct;
import java.io.InputStream;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class S3FileStorageService {

    private final MinioClient minioClient;

    @Value("${minio.bucket-name}")
    private String bucketName;

    @Value("${minio.public-url:}")
    private String publicUrl;

    // Allowed file extensions for security
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
            ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp"
    );

    // Allowed MIME types for security
    private static final Set<String> ALLOWED_MIME_TYPES = Set.of(
            "image/jpeg", "image/png", "image/gif", "image/webp",
            "image/svg+xml", "image/bmp"
    );

    // Maximum file size: 50MB
    private static final long MAX_FILE_SIZE = 50 * 1024 * 1024;

    @PostConstruct
    public void init() {
        try {
            // Check if bucket exists, create if not
            boolean found = minioClient.bucketExists(
                    BucketExistsArgs.builder()
                            .bucket(bucketName)
                            .build()
            );

            if (!found) {
                minioClient.makeBucket(
                        MakeBucketArgs.builder()
                                .bucket(bucketName)
                                .build()
                );
                log.info("Created MinIO bucket: {}", bucketName);
                
                // Set bucket to private by default - only presigned URLs can access
                String policy = """
                {
                    "Version": "2012-10-17",
                    "Statement": [
                        {
                            "Effect": "Deny",
                            "Principal": {"AWS": "*"},
                            "Action": "s3:GetObject",
                            "Resource": "arn:aws:s3:::%s/*"
                        }
                    ]
                }
                """.formatted(bucketName);
                
                minioClient.setBucketPolicy(
                        SetBucketPolicyArgs.builder()
                                .bucket(bucketName)
                                .config(policy)
                                .build()
                );
                log.info("Set bucket policy to private for: {}", bucketName);
            } else {
                log.info("MinIO bucket already exists: {}", bucketName);
            }
        } catch (Exception e) {
            log.error("Error initializing MinIO bucket", e);
            throw new RuntimeException("Could not initialize MinIO bucket", e);
        }
    }

    public String storeFile(MultipartFile file) {
        try {
            if (file.isEmpty()) {
                throw new IllegalArgumentException("Cannot upload empty file");
            }

            if (file.getSize() > MAX_FILE_SIZE) {
                throw new IllegalArgumentException(
                        String.format("File too large. Maximum size: %d MB", MAX_FILE_SIZE / 1024 / 1024)
                );
            }

            String contentType = file.getContentType();
            if (contentType == null || !ALLOWED_MIME_TYPES.contains(contentType)) {
                throw new IllegalArgumentException(
                        "Unsupported file type: " + contentType + ". Allowed types: images only"
                );
            }

            String originalFilename = file.getOriginalFilename();
            if (originalFilename == null || originalFilename.isBlank()) {
                throw new IllegalArgumentException("Filename is required");
            }

            String extension = "";
            if (originalFilename.contains(".")) {
                extension = originalFilename.substring(originalFilename.lastIndexOf(".")).toLowerCase();
                if (!ALLOWED_EXTENSIONS.contains(extension)) {
                    throw new IllegalArgumentException(
                            "Unsupported file extension: " + extension + ". Allowed: " + ALLOWED_EXTENSIONS
                    );
                }
            } else {
                throw new IllegalArgumentException("File must have an extension");
            }

            // Generate unique filename
            String filename = UUID.randomUUID() + extension;

            // Upload file to MinIO
            minioClient.putObject(
                    PutObjectArgs.builder()
                            .bucket(bucketName)
                            .object(filename)
                            .stream(file.getInputStream(), file.getSize(), -1)
                            .contentType(contentType)
                            .build()
            );

            log.info("Uploaded file to MinIO: {} (size: {} bytes, type: {})",
                    filename, file.getSize(), contentType);
            return filename;
        } catch (IllegalArgumentException e) {
            log.warn("File validation failed: {}", e.getMessage());
            throw e;
        } catch (Exception e) {
            log.error("Error storing file in MinIO", e);
            throw new RuntimeException("Could not store file", e);
        }
    }

    public InputStream getFileStream(String filename) {
        try {
            return minioClient.getObject(
                    GetObjectArgs.builder()
                            .bucket(bucketName)
                            .object(filename)
                            .build()
            );
        } catch (Exception e) {
            log.error("Error retrieving file from MinIO: {}", filename, e);
            throw new RuntimeException("Could not retrieve file", e);
        }
    }

    public String getPresignedUrl(String filename, int expiryMinutes) {
        try {
            // Validate filename to prevent path traversal
            if (filename.contains("..") || filename.contains("/") || filename.contains("\\")) {
                throw new IllegalArgumentException("Invalid filename");
            }
            
            String presignedUrl = minioClient.getPresignedObjectUrl(
                    GetPresignedObjectUrlArgs.builder()
                            .method(Method.GET)
                            .bucket(bucketName)
                            .object(filename)
                            .expiry(expiryMinutes, TimeUnit.MINUTES)
                            .build()
            );

            // If public URL is configured, rewrite internal URL to public URL
            if (publicUrl != null && !publicUrl.isEmpty()) {
                // Replace the internal endpoint with public URL
                // Internal: http://minio:9000/bucket/object?params
                // Public: https://minio.dylancree.com/bucket/object?params
                presignedUrl = presignedUrl.replace("http://minio:9000", publicUrl);
                log.debug("Rewrote presigned URL for {} to use public endpoint (expires in {} min)", filename, expiryMinutes);
            } else {
                log.debug("Generated presigned URL for {} (expires in {} min)", filename, expiryMinutes);
            }
            return presignedUrl;
        } catch (IllegalArgumentException e) {
            log.warn("Invalid presigned URL request: {}", e.getMessage());
            throw e;
        } catch (Exception e) {
            log.error("Error generating presigned URL for: {}", filename, e);
            throw new RuntimeException("Could not generate presigned URL", e);
        }
    }

    public void deleteFile(String filename) {
        try {
            minioClient.removeObject(
                    RemoveObjectArgs.builder()
                            .bucket(bucketName)
                            .object(filename)
                            .build()
            );
            log.info("Deleted file from MinIO: {}", filename);
        } catch (Exception e) {
            log.error("Error deleting file from MinIO: {}", filename, e);
            throw new RuntimeException("Could not delete file", e);
        }
    }

    public StatObjectResponse getFileMetadata(String filename) {
        try {
            return minioClient.statObject(
                    StatObjectArgs.builder()
                            .bucket(bucketName)
                            .object(filename)
                            .build()
            );
        } catch (Exception e) {
            log.error("Error getting file metadata: {}", filename, e);
            throw new RuntimeException("Could not get file metadata", e);
        }
    }
}
