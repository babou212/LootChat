package com.lootchat.LootChat.controller;

import com.lootchat.LootChat.service.S3FileStorageService;
import io.minio.StatObjectResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
public class FileController {

    private final S3FileStorageService s3FileStorageService;

    @GetMapping("/images/{fileName:.+}")
    public ResponseEntity<Map<String, String>> getPresignedUrl(@PathVariable String fileName) {
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
            // Verify file exists before generating presigned URL
            StatObjectResponse metadata = s3FileStorageService.getFileMetadata(fileName);
            log.debug("Generating presigned URL for file: {} (size: {} bytes)",
                    fileName, metadata.size());

            String presignedUrl = s3FileStorageService.getPresignedUrl(fileName, 60);

            Map<String, String> response = new HashMap<>();
            response.put("url", presignedUrl);
            response.put("fileName", fileName);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Failed to generate presigned URL for file: {}", fileName, e);
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
    }
}
