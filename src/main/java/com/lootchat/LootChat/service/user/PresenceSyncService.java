package com.lootchat.LootChat.service.user;

import com.lootchat.LootChat.dto.user.UserPresenceUpdate;
import com.lootchat.LootChat.entity.User;
import com.lootchat.LootChat.repository.UserRepository;
import com.lootchat.LootChat.service.common.WebSocketBroadcastService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Presence Sync Service
 * 
 * Periodically broadcasts presence state to all connected WebSocket clients.
 * This solves the multi-pod issue where presence updates might not reach
 * all users because they're connected to different backend pods.
 * 
 * Features:
 * - Broadcasts full presence state every 30 seconds
 * - Only broadcasts if there are connected users
 * - Reduces individual presence event reliance
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PresenceSyncService {
    
    private static final String PRESENCE_KEY_PREFIX = "user:presence:";
    
    private final RedisTemplate<String, String> redisTemplate;
    private final UserRepository userRepository;
    private final WebSocketBroadcastService broadcastService;
    
    /**
     * Broadcast presence sync to all connected clients every 30 seconds.
     * This ensures all clients have accurate presence information even
     * if they missed individual presence update events.
     * 
     * Note: We always broadcast via Kafka regardless of local user count,
     * since other pods may have connected users.
     */
    @Scheduled(fixedDelay = 30000) // 30 seconds
    public void syncPresence() {
        try {
            List<UserPresenceUpdate> presenceList = getPresenceList();
            
            if (!presenceList.isEmpty()) {
                // Broadcast to all pods via Kafka, each pod delivers to its local clients
                broadcastService.broadcast("/topic/user-presence/sync", presenceList);
                log.debug("Broadcasted presence sync with {} online users", presenceList.size());
            }
        } catch (Exception e) {
            log.error("Failed to sync presence", e);
        }
    }
    
    /**
     * Get list of all online users with their presence info.
     */
    private List<UserPresenceUpdate> getPresenceList() {
        List<UserPresenceUpdate> presenceList = new ArrayList<>();
        Set<String> keys = redisTemplate.keys(PRESENCE_KEY_PREFIX + "*");
        
        if (keys == null || keys.isEmpty()) {
            return presenceList;
        }
        
        for (String key : keys) {
            try {
                String username = key.replace(PRESENCE_KEY_PREFIX, "");
                String status = redisTemplate.opsForValue().get(key);
                
                if ("online".equals(status)) {
                    User user = userRepository.findByUsername(username);
                    if (user != null) {
                        presenceList.add(UserPresenceUpdate.builder()
                                .userId(user.getId())
                                .username(username)
                                .status("online")
                                .build());
                    }
                }
            } catch (Exception e) {
                log.warn("Error getting presence for key: {}", key, e);
            }
        }
        
        return presenceList;
    }
}
