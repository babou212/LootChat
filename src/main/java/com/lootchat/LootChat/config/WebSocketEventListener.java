package com.lootchat.LootChat.config;

import com.lootchat.LootChat.repository.UserRepository;
import com.lootchat.LootChat.service.user.UserPresenceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.web.socket.messaging.SessionSubscribeEvent;

import java.util.concurrent.TimeUnit;

@Component
@RequiredArgsConstructor
@Slf4j
public class WebSocketEventListener {
    private static final String SESSION_KEY_PREFIX = "ws:session:";
    private static final long SESSION_TTL_MINUTES = 10; // Auto-expire stale sessions
    
    private final UserPresenceService userPresenceService;
    private final UserRepository userRepository;
    private final RedisTemplate<String, String> redisTemplate;

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
            
            String sessionKey = SESSION_KEY_PREFIX + sessionId;
            String existingUser = redisTemplate.opsForValue().get(sessionKey);
            
            if (existingUser == null) {
                redisTemplate.opsForValue().set(sessionKey, username, SESSION_TTL_MINUTES, TimeUnit.MINUTES);
                
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
        
        String sessionKey = SESSION_KEY_PREFIX + sessionId;
        String username = redisTemplate.opsForValue().get(sessionKey);
        redisTemplate.delete(sessionKey);
        
        if (username != null) {
            var user = userRepository.findByUsername(username);
            if (user != null) {
                log.info("User disconnected: {} (ID: {})", username, user.getId());
                userPresenceService.userDisconnected(username, user.getId());
            }
        }
    }
}
