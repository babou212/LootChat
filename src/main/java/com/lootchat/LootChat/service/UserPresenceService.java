package com.lootchat.LootChat.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lootchat.LootChat.dto.UserPresenceEvent;
import com.lootchat.LootChat.entity.User;
import com.lootchat.LootChat.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
public class UserPresenceService {
    
    private static final Logger log = LoggerFactory.getLogger(UserPresenceService.class);
    
    private final UserRepository userRepository;
    private final KafkaProducerService kafkaProducerService;
    private final ObjectMapper objectMapper;
    
    // Maps username to their online status
    private final Map<String, Boolean> userPresence = new ConcurrentHashMap<>();
    
    public void userConnected(String username, Long userId) {
        userPresence.put(username, true);
        broadcastPresenceUpdate(userId, username, "online");
    }
    
    public void userDisconnected(String username, Long userId) {
        userPresence.put(username, false);
        broadcastPresenceUpdate(userId, username, "offline");
    }
    
    public boolean isUserOnline(String username) {
        return userPresence.getOrDefault(username, false);
    }
    
    public Set<String> getOnlineUsers() {
        return userPresence.entrySet().stream()
                .filter(Map.Entry::getValue)
                .map(Map.Entry::getKey)
                .collect(java.util.stream.Collectors.toSet());
    }
    
    public Map<Long, Boolean> getAllUserPresence() {
        Map<Long, Boolean> presenceMap = new HashMap<>();
        userPresence.forEach((username, isOnline) -> {
            User user = userRepository.findByUsername(username);
            if (user != null) {
                presenceMap.put(user.getId(), isOnline);
            }
        });
        return presenceMap;
    }
    
    private void broadcastPresenceUpdate(Long userId, String username, String status) {
        try {
            UserPresenceEvent event = new UserPresenceEvent(userId, username, status);
            String payload = objectMapper.writeValueAsString(event);
            kafkaProducerService.send(null, null, payload);
            log.debug("Published user presence update to Kafka: userId={}, username={}, status={}", 
                userId, username, status);
        } catch (Exception e) {
            log.error("Failed to publish user presence to Kafka", e);
        }
    }
}
