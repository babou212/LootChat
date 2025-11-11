package com.lootchat.LootChat.config;

import com.lootchat.LootChat.repository.UserRepository;
import com.lootchat.LootChat.service.UserPresenceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.web.socket.messaging.SessionSubscribeEvent;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
@RequiredArgsConstructor
@Slf4j
public class WebSocketEventListener {
    private final UserPresenceService userPresenceService;
    private final UserRepository userRepository;
    
    // Track sessions to usernames
    private final Map<String, String> sessionUsers = new ConcurrentHashMap<>();

    @EventListener
    public void handleWebSocketConnectListener(SessionConnectedEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = headerAccessor.getSessionId();
        
        log.info("WebSocket Connected - Session ID: {}", sessionId);
    }
    
    @EventListener
    public void handleWebSocketSubscribeListener(SessionSubscribeEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        Authentication authentication = (Authentication) headerAccessor.getUser();
        String sessionId = headerAccessor.getSessionId();
        
        if (authentication != null && authentication.getPrincipal() instanceof UserDetails) {
            UserDetails userDetails = (UserDetails) authentication.getPrincipal();
            String username = userDetails.getUsername();
            
            // Only process once per session
            if (!sessionUsers.containsKey(sessionId)) {
                sessionUsers.put(sessionId, username);
                
                // Get user ID from repository
                var user = userRepository.findByUsername(username);
                if (user != null) {
                    log.info("User subscribed and marked online: {} (ID: {})", username, user.getId());
                    userPresenceService.userConnected(username, user.getId());
                }
            }
        }
    }

    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = headerAccessor.getSessionId();
        
        // Get username from session map
        String username = sessionUsers.remove(sessionId);
        
        if (username != null) {
            // Get user ID from repository
            var user = userRepository.findByUsername(username);
            if (user != null) {
                log.info("User disconnected: {} (ID: {})", username, user.getId());
                userPresenceService.userDisconnected(username, user.getId());
            }
        }
    }
}
