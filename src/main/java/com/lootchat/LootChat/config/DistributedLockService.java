package com.lootchat.LootChat.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.UUID;

/**
 * Distributed lock service using Redis
 * Prevents race conditions when multiple pods try to modify the same resource
 * 
 * Use cases:
 * - Creating invite tokens (prevent duplicates)
 * - Channel creation (prevent duplicate names)
 * - File upload operations
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DistributedLockService {
    
    private final RedisTemplate<String, String> redisTemplate;
    
    /**
     * Try to acquire a distributed lock
     * 
     * @param lockKey Unique lock identifier (e.g., "channel:create:gaming")
     * @param lockTimeout How long to hold the lock (safety mechanism)
     * @return Lock token if acquired, null if lock already held
     */
    public String tryLock(String lockKey, Duration lockTimeout) {
        String fullKey = "lock:" + lockKey;
        String lockToken = UUID.randomUUID().toString();
        
        Boolean acquired = redisTemplate.opsForValue()
            .setIfAbsent(fullKey, lockToken, lockTimeout);
        
        if (Boolean.TRUE.equals(acquired)) {
            log.debug("Acquired lock: {}", lockKey);
            return lockToken;
        }
        
        log.debug("Failed to acquire lock: {}", lockKey);
        return null;
    }
    
    /**
     * Release a previously acquired lock
     * 
     * @param lockKey The lock identifier
     * @param lockToken The token returned from tryLock
     * @return true if successfully released, false if lock was already released or expired
     */
    public boolean unlock(String lockKey, String lockToken) {
        String fullKey = "lock:" + lockKey;
        String currentToken = redisTemplate.opsForValue().get(fullKey);
        
        if (lockToken.equals(currentToken)) {
            redisTemplate.delete(fullKey);
            log.debug("Released lock: {}", lockKey);
            return true;
        }
        
        log.warn("Failed to release lock: {} (token mismatch or already released)", lockKey);
        return false;
    }
    
    /**
     * Execute an action with a distributed lock
     * Automatically handles lock acquisition and release
     * 
     * @param lockKey Lock identifier
     * @param timeout Lock timeout
     * @param action Code to execute while holding the lock
     * @param <T> Return type
     * @return Result from action, or null if lock couldn't be acquired
     */
    public <T> T withLock(String lockKey, Duration timeout, java.util.function.Supplier<T> action) {
        String token = tryLock(lockKey, timeout);
        if (token == null) {
            log.warn("Could not acquire lock for: {}", lockKey);
            return null;
        }
        
        try {
            return action.get();
        } finally {
            unlock(lockKey, token);
        }
    }
}
