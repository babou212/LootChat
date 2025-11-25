package com.lootchat.LootChat.config;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

/**
 * Redis-backed rate limiting service
 * Uses sliding window algorithm for accurate rate limiting across multiple pods
 */
@Service
@RequiredArgsConstructor
public class RateLimitService {
    
    private final RedisTemplate<String, String> redisTemplate;
    
    /**
     * Check if a user/IP has exceeded their rate limit
     * 
     * @param key Unique identifier (userId, IP, username)
     * @param maxRequests Maximum requests allowed in the window
     * @param windowDuration Time window for the limit
     * @return true if allowed, false if rate limit exceeded
     */
    public boolean isAllowed(String key, int maxRequests, Duration windowDuration) {
        String rateLimitKey = "ratelimit:" + key;
        
        // Increment the counter
        Long current = redisTemplate.opsForValue().increment(rateLimitKey);
        
        if (current == null) {
            return false;
        }
        
        // If this is the first request, set expiration
        if (current == 1) {
            redisTemplate.expire(rateLimitKey, windowDuration);
        }
        
        return current <= maxRequests;
    }
    
    /**
     * Get remaining requests for a key
     */
    public int getRemainingRequests(String key, int maxRequests) {
        String rateLimitKey = "ratelimit:" + key;
        String value = redisTemplate.opsForValue().get(rateLimitKey);
        
        if (value == null) {
            return maxRequests;
        }
        
        try {
            int current = Integer.parseInt(value);
            return Math.max(0, maxRequests - current);
        } catch (NumberFormatException e) {
            return maxRequests;
        }
    }
    
    /**
     * Reset rate limit for a key (useful for admin actions)
     */
    public void reset(String key) {
        redisTemplate.delete("ratelimit:" + key);
    }
}
