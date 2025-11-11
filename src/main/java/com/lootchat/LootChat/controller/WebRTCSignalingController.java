package com.lootchat.LootChat.controller;

import com.lootchat.LootChat.dto.WebRTCSignalRequest;
import com.lootchat.LootChat.dto.WebRTCSignalResponse;
import com.lootchat.LootChat.entity.User;
import com.lootchat.LootChat.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.security.Principal;

@Controller
@RequiredArgsConstructor
@Slf4j
public class WebRTCSignalingController {

    private final SimpMessagingTemplate messagingTemplate;
    private final UserRepository userRepository;

    @MessageMapping("/webrtc/signal")
    public void handleSignal(@Payload WebRTCSignalRequest request, Principal principal) {
        log.info("Received WebRTC signal: type={}, channelId={}, from={}, to={}", 
            request.getType(), request.getChannelId(), request.getFromUserId(), request.getToUserId());

        try {
            User fromUser = userRepository.findById(Long.parseLong(request.getFromUserId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

            WebRTCSignalResponse response = WebRTCSignalResponse.builder()
                .channelId(request.getChannelId())
                .type(request.getType())
                .fromUserId(request.getFromUserId())
                .fromUsername(fromUser.getUsername())
                .toUserId(request.getToUserId())
                .data(request.getData())
                .build();

            switch (request.getType()) {
                case JOIN:
                case LEAVE:
                    messagingTemplate.convertAndSend(
                        "/topic/channels/" + request.getChannelId() + "/webrtc",
                        response
                    );
                    log.info("Broadcasted {} from user {} (username: {})", 
                        request.getType(), request.getFromUserId(), fromUser.getUsername());
                    break;
                    
                case OFFER:
                case ANSWER:
                case ICE_CANDIDATE:
                    if (request.getToUserId() != null && !request.getToUserId().isEmpty()) {
                        User toUser = userRepository.findById(Long.parseLong(request.getToUserId()))
                            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Target user not found"));
                        
                        messagingTemplate.convertAndSendToUser(
                            toUser.getUsername(),  
                            "/queue/webrtc/signal",
                            response
                        );
                        log.info("Sent {} from user {} to user {} (username: {})", 
                            request.getType(), request.getFromUserId(), request.getToUserId(), toUser.getUsername());
                    } else {
                        log.warn("OFFER/ANSWER/ICE_CANDIDATE signal without target user");
                    }
                    break;
                    
                default:
                    log.warn("Unknown signal type: {}", request.getType());
            }

        } catch (Exception e) {
            log.error("Error handling WebRTC signal", e);
        }
    }
}
