package com.lootchat.LootChat.service;

import com.lootchat.LootChat.dto.UserPresenceEvent;
import com.lootchat.LootChat.entity.User;
import com.lootchat.LootChat.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
public class UserPresenceService {
    
    private static final Logger log = LoggerFactory.getLogger(UserPresenceService.class);
    private static final String PRESENCE_KEY_PREFIX = "user:presence:";
    private static final long PRESENCE_TTL_MINUTES = 5; // Auto-expire after 5 minutes
    
    private final UserRepository userRepository;
    private final OutboxService outboxService;
    private final RedisTemplate<String, String> redisTemplate;
    
    @Transactional
    public void userConnected(String username, Long userId) {
        String key = PRESENCE_KEY_PREFIX + username;
        redisTemplate.opsForValue().set(key, "online", PRESENCE_TTL_MINUTES, TimeUnit.MINUTES);
        broadcastPresenceUpdate(userId, username, "online");
    }
    
    @Transactional
    public void userDisconnected(String username, Long userId) {
        String key = PRESENCE_KEY_PREFIX + username;
        redisTemplate.delete(key);
        broadcastPresenceUpdate(userId, username, "offline");
    }
    
    public boolean isUserOnline(String username) {
        String key = PRESENCE_KEY_PREFIX + username;
        String status = redisTemplate.opsForValue().get(key);
        return "online".equals(status);
    }
    
    /**
     * Refresh the current user's presence TTL without broadcasting.
     * Called by heartbeat endpoint to keep presence alive.
     * This method does NOT broadcast through the outbox - it just updates Redis directly.
     * The PresenceSyncService will periodically broadcast the presence state to all clients.
     */
    public void refreshCurrentUserPresence() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof UserDetails) {
            UserDetails userDetails = (UserDetails) authentication.getPrincipal();
            String username = userDetails.getUsername();
            
            String key = PRESENCE_KEY_PREFIX + username;
            String currentStatus = redisTemplate.opsForValue().get(key);
            
            if ("online".equals(currentStatus)) {
                // Just refresh the TTL, don't broadcast
                redisTemplate.expire(key, PRESENCE_TTL_MINUTES, TimeUnit.MINUTES);
                log.debug("Refreshed presence TTL for user: {}", username);
            } else {
                // User wasn't marked online, re-establish presence in Redis directly
                // No broadcasting - the PresenceSyncService will handle that
                redisTemplate.opsForValue().set(key, "online", PRESENCE_TTL_MINUTES, TimeUnit.MINUTES);
                log.info("Re-established presence in Redis for user: {}", username);
            }
        }
    }
    
    public Set<String> getOnlineUsers() {
        Set<String> keys = redisTemplate.keys(PRESENCE_KEY_PREFIX + "*");
        if (keys == null) return Set.of();
        
        return keys.stream()
                .map(key -> key.replace(PRESENCE_KEY_PREFIX, ""))
                .collect(java.util.stream.Collectors.toSet());
    }
    
    public Map<Long, Boolean> getAllUserPresence() {
        Map<Long, Boolean> presenceMap = new HashMap<>();
        Set<String> keys = redisTemplate.keys(PRESENCE_KEY_PREFIX + "*");
        
        if (keys != null) {
            keys.forEach(key -> {
                String username = key.replace(PRESENCE_KEY_PREFIX, "");
                User user = userRepository.findByUsername(username);
                if (user != null) {
                    String status = redisTemplate.opsForValue().get(key);
                    presenceMap.put(user.getId(), "online".equals(status));
                }
            });
        }
        
        return presenceMap;
    }
    
    private void broadcastPresenceUpdate(Long userId, String username, String status) {
        UserPresenceEvent event = new UserPresenceEvent(userId, username, status);
        outboxService.saveEvent(
                OutboxService.EVENT_PRESENCE_UPDATED,
                OutboxService.TOPIC_PRESENCE,
                userId.toString(),
                event
        );
        log.debug("Stored user presence update in outbox: userId={}, username={}, status={}", 
            userId, username, status);
    }
}
