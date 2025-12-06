package com.lootchat.LootChat.controller.file;

import com.lootchat.LootChat.service.file.S3FileStorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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
            // Generate presigned URL valid for 60 minutes
            // This URL includes temporary credentials and allows direct browser access to MinIO
            String presignedUrl = s3FileStorageService.getPresignedUrl(fileName, 60);
            log.debug("Generated presigned URL for file: {}", fileName);

            return ResponseEntity.ok(Map.of(
                    "url", presignedUrl,
                    "fileName", fileName
            ));
        } catch (Exception e) {
            log.error("Failed to generate presigned URL for file: {}", fileName, e);
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
    }
}
