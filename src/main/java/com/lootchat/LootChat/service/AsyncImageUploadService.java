package com.lootchat.LootChat.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.concurrent.CompletableFuture;

/**
 * Asynchronous image upload service
 * Uploads images in background thread pool to avoid blocking request threads
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AsyncImageUploadService {
    
    private final S3FileStorageService s3FileStorageService;
    
    /**
     * Upload image asynchronously
     * @return CompletableFuture with image filename
     */
    @Async("taskExecutor")
    public CompletableFuture<String> uploadImageAsync(MultipartFile image) {
        try {
            log.debug("Starting async image upload: {}", image.getOriginalFilename());
            String filename = s3FileStorageService.storeFile(image);
            log.debug("Completed async image upload: {}", filename);
            return CompletableFuture.completedFuture(filename);
        } catch (Exception e) {
            log.error("Failed to upload image asynchronously", e);
            return CompletableFuture.failedFuture(e);
        }
    }
}
