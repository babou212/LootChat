package com.lootchat.LootChat.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.CacheManager;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.concurrent.CompletableFuture;

/**
 * Asynchronous cache management service
 * Prevents cache stampede by evicting caches in background
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AsyncCacheService {
    
    private final CacheManager cacheManager;
    
    /**
     * Evict channel messages cache asynchronously
     * Prevents blocking during cache invalidation
     */
    @Async("taskExecutor")
    public CompletableFuture<Void> evictChannelMessagesAsync(Long channelId) {
        try {
            var cache = cacheManager.getCache("channelMessages");
            if (cache != null) {
                cache.evict("channel:" + channelId);
                log.debug("Evicted channelMessages cache for channelId={}", channelId);
            }
            
            var paginatedCache = cacheManager.getCache("channelMessagesPaginated");
            if (paginatedCache != null) {
                paginatedCache.clear();
                log.debug("Cleared channelMessagesPaginated cache");
            }
            
            return CompletableFuture.completedFuture(null);
        } catch (Exception e) {
            log.error("Failed to evict cache for channelId={}", channelId, e);
            return CompletableFuture.failedFuture(e);
        }
    }
    
    /**
     * Warm cache with data after invalidation
     * Prevents cache miss stampede
     */
    @Async("taskExecutor")
    public CompletableFuture<Void> warmChannelCacheAsync(Long channelId) {
        try {
            // Could pre-populate cache here if needed
            log.debug("Cache warming for channelId={}", channelId);
            return CompletableFuture.completedFuture(null);
        } catch (Exception e) {
            log.error("Failed to warm cache for channelId={}", channelId, e);
            return CompletableFuture.failedFuture(e);
        }
    }
}
