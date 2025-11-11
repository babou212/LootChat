package com.lootchat.LootChat.service;

import com.lootchat.LootChat.dto.UserPresenceUpdate;
import com.lootchat.LootChat.entity.User;
import com.lootchat.LootChat.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
public class UserPresenceService {
    private final SimpMessagingTemplate messagingTemplate;
    private final UserRepository userRepository;
    
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
        UserPresenceUpdate update = UserPresenceUpdate.builder()
                .userId(userId)
                .username(username)
                .status(status)
                .build();
        
        messagingTemplate.convertAndSend("/topic/user-presence", update);
    }
}
