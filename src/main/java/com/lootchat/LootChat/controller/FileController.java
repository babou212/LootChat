package com.lootchat.LootChat.controller;

import com.lootchat.LootChat.service.S3FileStorageService;
import io.minio.StatObjectResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.InputStream;

@Slf4j
@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
public class FileController {

    private final S3FileStorageService s3FileStorageService;

    @GetMapping("/images/{fileName:.+}")
    public ResponseEntity<InputStreamResource> getFile(@PathVariable String fileName) {
        // Validate filename to prevent path traversal attacks
        if (fileName == null || fileName.isBlank()) {
            log.warn("Empty filename requested");
            return ResponseEntity.badRequest().build();
        }

        if (fileName.contains("..") || fileName.contains("/") || fileName.contains("\\")) {
            log.warn("Invalid filename requested (path traversal attempt): {}", fileName);
            return ResponseEntity.badRequest().build();
        }

        try {
            // Get file metadata
            StatObjectResponse metadata = s3FileStorageService.getFileMetadata(fileName);
            log.debug("Serving file: {} (size: {} bytes)", fileName, metadata.size());

            // Get file input stream
            InputStream fileStream = s3FileStorageService.getFileStream(fileName);
            InputStreamResource resource = new InputStreamResource(fileStream);

            // Determine content type from metadata
            String contentType = metadata.contentType();
            if (contentType == null || contentType.isBlank()) {
                contentType = MediaType.APPLICATION_OCTET_STREAM_VALUE;
            }

            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .contentLength(metadata.size())
                    .header(HttpHeaders.CACHE_CONTROL, "public, max-age=31536000")
                    .body(resource);
        } catch (Exception e) {
            log.error("Failed to serve file: {}", fileName, e);
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
    }
}
