package com.lootchat.LootChat.service.user;

import com.lootchat.LootChat.dto.user.UserPresenceEvent;
import com.lootchat.LootChat.entity.User;
import com.lootchat.LootChat.repository.UserRepository;
import com.lootchat.LootChat.service.inbox.OutboxService;
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
    private static final String CONNECTIONS_KEY_PREFIX = "user:connections:";
    private static final long PRESENCE_TTL_MINUTES = 5; // Auto-expire after 5 minutes
    
    private final UserRepository userRepository;
    private final OutboxService outboxService;
    private final RedisTemplate<String, String> redisTemplate;
    
    @Transactional
    public void userConnected(String username, Long userId) {
        String presenceKey = PRESENCE_KEY_PREFIX + username;
        String connectionsKey = CONNECTIONS_KEY_PREFIX + username;

        Long connectionCount = redisTemplate.opsForValue().increment(connectionsKey);
        redisTemplate.expire(connectionsKey, PRESENCE_TTL_MINUTES, TimeUnit.MINUTES);
        
        String previousStatus = redisTemplate.opsForValue().get(presenceKey);
        boolean wasOffline = !"online".equals(previousStatus);

        redisTemplate.opsForValue().set(presenceKey, "online", PRESENCE_TTL_MINUTES, TimeUnit.MINUTES);
        
        log.info("User connected: {} (connections: {}, wasOffline: {})", username, connectionCount, wasOffline);
        
        if (wasOffline) {
            broadcastPresenceUpdate(userId, username, "online");
        }
    }
    
    @Transactional
    public void userDisconnected(String username, Long userId) {
        String presenceKey = PRESENCE_KEY_PREFIX + username;
        String connectionsKey = CONNECTIONS_KEY_PREFIX + username;
        
        Long connectionCount = redisTemplate.opsForValue().decrement(connectionsKey);
        
        if (connectionCount == null || connectionCount < 0) {
            connectionCount = 0L;
            redisTemplate.delete(connectionsKey);
        }
        
        log.info("User disconnected: {} (remaining connections: {})", username, connectionCount);
        
        if (connectionCount <= 0) {
            redisTemplate.delete(presenceKey);
            redisTemplate.delete(connectionsKey);
            broadcastPresenceUpdate(userId, username, "offline");
            log.info("User fully offline: {}", username);
        } else {
            redisTemplate.expire(connectionsKey, PRESENCE_TTL_MINUTES, TimeUnit.MINUTES);
            redisTemplate.expire(presenceKey, PRESENCE_TTL_MINUTES, TimeUnit.MINUTES);
        }
    }
    
    public boolean isUserOnline(String username) {
        String key = PRESENCE_KEY_PREFIX + username;
        String status = redisTemplate.opsForValue().get(key);
        return "online".equals(status);
    }
    
    /**
     * Refresh the current user's presence TTL without broadcasting.
     * Called by heartbeat endpoint to keep presence alive.
     */
    public void refreshCurrentUserPresence() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof UserDetails) {
            UserDetails userDetails = (UserDetails) authentication.getPrincipal();
            String username = userDetails.getUsername();
            
            String presenceKey = PRESENCE_KEY_PREFIX + username;
            String connectionsKey = CONNECTIONS_KEY_PREFIX + username;
            String currentStatus = redisTemplate.opsForValue().get(presenceKey);
            
            if ("online".equals(currentStatus)) {
                redisTemplate.expire(presenceKey, PRESENCE_TTL_MINUTES, TimeUnit.MINUTES);
                redisTemplate.expire(connectionsKey, PRESENCE_TTL_MINUTES, TimeUnit.MINUTES);
                log.debug("Refreshed presence TTL for user: {}", username);
            } else {
                redisTemplate.opsForValue().set(presenceKey, "online", PRESENCE_TTL_MINUTES, TimeUnit.MINUTES);
                redisTemplate.opsForValue().increment(connectionsKey);
                redisTemplate.expire(connectionsKey, PRESENCE_TTL_MINUTES, TimeUnit.MINUTES);
                log.info("Re-established presence in Redis for user: {}", username);
            }
        }
    }
    
    public long getConnectionCount(String username) {
        String connectionsKey = CONNECTIONS_KEY_PREFIX + username;
        String count = redisTemplate.opsForValue().get(connectionsKey);
        return count != null ? Long.parseLong(count) : 0L;
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
