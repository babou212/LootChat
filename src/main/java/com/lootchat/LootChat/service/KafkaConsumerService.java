package com.lootchat.LootChat.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lootchat.LootChat.dto.*;
import com.lootchat.LootChat.entity.Message;
import com.lootchat.LootChat.repository.MessageRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class KafkaConsumerService {

    private static final Logger log = LoggerFactory.getLogger(KafkaConsumerService.class);
    private final ObjectMapper objectMapper;
    private final MessageRepository messageRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public KafkaConsumerService(ObjectMapper objectMapper, MessageRepository messageRepository, 
                                SimpMessagingTemplate messagingTemplate) {
        this.objectMapper = objectMapper;
        this.messageRepository = messageRepository;
        this.messagingTemplate = messagingTemplate;
    }

    @KafkaListener(
        topics = "${app.kafka.topics.chat:lootchat.chat.messages}", 
        groupId = "${spring.kafka.consumer.group-id}",
        concurrency = "${spring.kafka.listener.concurrency:3}"
    )
    public void consumeKafkaEvent(String raw) {
        log.debug("Kafka consumed raw payload: {}", raw);
        
        try {
            // First, try to parse as a generic JSON to check for event type indicators
            com.fasterxml.jackson.databind.JsonNode node = objectMapper.readTree(raw);
            
            // Check for ReactionEvent first (has reactionId, action, and emoji - most specific)
            if (node.has("reactionId") && node.has("action") && node.has("emoji")) {
                handleReaction(raw);
            }
            // Check for MessageDeleteEvent (has messageId but no content, and no reactionId)
            else if (node.has("messageId") && !node.has("content") && !node.has("reactionId") && node.has("channelId")) {
                handleMessageDelete(raw);
            }
            // Check for MessageUpdateEvent (has messageId and content, but no reactionId)
            else if (node.has("messageId") && node.has("content") && !node.has("reactionId") && !node.has("userId")) {
                handleMessageUpdate(raw);
            }
            // Check for ChatMessageEvent (has messageId, userId, and content, but no reactionId)
            else if (node.has("messageId") && node.has("userId") && node.has("content") && !node.has("reactionId")) {
                handleChatMessage(raw);
            }
            // Check for UserPresenceEvent (has status field and no messageId)
            else if (node.has("userId") && node.has("status") && node.has("username") && !node.has("messageId")) {
                handleUserPresence(raw);
            }
            else {
                log.warn("Unknown Kafka event type: {}", raw);
            }
        } catch (Exception e) {
            log.error("Failed to process Kafka event: {}", raw, e);
        }
    }
    
    private void handleChatMessage(String raw) {
        try {
            ChatMessageEvent event = objectMapper.readValue(raw, ChatMessageEvent.class);
            log.debug("Handling ChatMessageEvent: {}", event);
            
            if (event.getMessageId() == null) {
                log.warn("Skipping ChatMessageEvent without messageId: {}", raw);
                return;
            }
            
            Message message = messageRepository.findByIdWithUserAndChannel(event.getMessageId())
                .orElse(null);
            
            if (message == null) {
                log.warn("No message found for Kafka event with messageId={}", event.getMessageId());
                return;
            }
            
            MessageResponse response = buildMessageResponse(message);
            
            if (message.getChannel() != null) {
                messagingTemplate.convertAndSend("/topic/channels/" + message.getChannel().getId() + "/messages", response);
            }
            messagingTemplate.convertAndSend("/topic/messages", response);
            
            log.info("Successfully broadcasted message from Kafka: messageId={}, channelId={}", 
                response.getId(), message.getChannel() != null ? message.getChannel().getId() : null);
        } catch (Exception e) {
            log.error("Failed to handle chat message: {}", raw, e);
        }
    }
    
    private MessageResponse buildMessageResponse(Message message) {
        return MessageResponse.builder()
                .id(message.getId())
                .content(message.getContent())
                .userId(message.getUser().getId())
                .username(message.getUser().getUsername())
                .avatar(message.getUser().getAvatar())
                .imageUrl(message.getImageUrl())
                .imageFilename(message.getImageFilename())
                .channelId(message.getChannel() != null ? message.getChannel().getId() : null)
                .channelName(message.getChannel() != null ? message.getChannel().getName() : null)
                .createdAt(message.getCreatedAt())
                .updatedAt(message.getUpdatedAt())
                .reactions(List.of()) 
                .build();
    }

    
    private void handleMessageUpdate(String raw) {
        try {
            MessageUpdateEvent event = objectMapper.readValue(raw, MessageUpdateEvent.class);
            log.debug("Handling MessageUpdateEvent: {}", event);
            
            if (event.getMessageId() == null || event.getContent() == null) {
                return;
            }
            
            Message message = messageRepository.findByIdWithUserAndChannel(event.getMessageId())
                .orElse(null);
            
            if (message == null) {
                log.warn("No message found for update event with messageId={}", event.getMessageId());
                return;
            }
            
            MessageResponse response = buildMessageResponse(message);
            
            if (event.getChannelId() != null) {
                messagingTemplate.convertAndSend("/topic/channels/" + event.getChannelId() + "/messages", response);
            }
            messagingTemplate.convertAndSend("/topic/messages", response);
            
            log.info("Successfully broadcasted message update from Kafka: messageId={}, channelId={}", 
                event.getMessageId(), event.getChannelId());
        } catch (Exception e) {
            log.error("Failed to handle message update: {}", raw, e);
        }
    }

    private void handleMessageDelete(String raw) {
        try {
            MessageDeleteEvent event = objectMapper.readValue(raw, MessageDeleteEvent.class);
            log.debug("Handling MessageDeleteEvent: {}", event);
            
            if (event.getMessageId() == null) {
                return;
            }
            
            var deletionPayload = Map.of(
                "id", event.getMessageId(),
                "channelId", event.getChannelId() != null ? event.getChannelId() : 0
            );
            
            messagingTemplate.convertAndSend("/topic/messages/delete", deletionPayload);
            if (event.getChannelId() != null) {
                messagingTemplate.convertAndSend("/topic/channels/" + event.getChannelId() + "/messages/delete", deletionPayload);
            }
            
            log.info("Successfully broadcasted message delete from Kafka: messageId={}, channelId={}", 
                event.getMessageId(), event.getChannelId());
        } catch (Exception e) {
            log.error("Failed to handle message delete: {}", raw, e);
        }
    }

    private void handleReaction(String raw) {
        try {
            ReactionEvent event = objectMapper.readValue(raw, ReactionEvent.class);
            log.debug("Handling ReactionEvent: {}", event);
            
            if (event.getReactionId() == null || event.getMessageId() == null || 
                event.getAction() == null || event.getEmoji() == null || 
                event.getUserId() == null || event.getUsername() == null) {
                return;
            }
            
            ReactionResponse response = ReactionResponse.builder()
                .id(event.getReactionId())
                .emoji(event.getEmoji())
                .userId(event.getUserId())
                .username(event.getUsername())
                .messageId(event.getMessageId())
                .createdAt(java.time.LocalDateTime.now())
                .build();
            
            String topic = "add".equals(event.getAction()) ? "/topic/reactions" : "/topic/reactions/remove";
            String channelTopic = "add".equals(event.getAction()) ? 
                "/topic/channels/" + event.getChannelId() + "/reactions" : 
                "/topic/channels/" + event.getChannelId() + "/reactions/remove";
            
            if (event.getChannelId() != null) {
                messagingTemplate.convertAndSend(channelTopic, response);
            }
            messagingTemplate.convertAndSend(topic, response);
            
            log.info("Successfully broadcasted reaction {} from Kafka: reactionId={}, messageId={}, channelId={}", 
                event.getAction(), event.getReactionId(), event.getMessageId(), event.getChannelId());
        } catch (Exception e) {
            log.error("Failed to handle reaction: {}", raw, e);
        }
    }

    private void handleUserPresence(String raw) {
        try {
            UserPresenceEvent event = objectMapper.readValue(raw, UserPresenceEvent.class);
            log.debug("Handling UserPresenceEvent: {}", event);
            
            if (event.getUserId() == null || event.getUsername() == null || event.getStatus() == null) {
                return;
            }
            
            UserPresenceUpdate update = UserPresenceUpdate.builder()
                .userId(event.getUserId())
                .username(event.getUsername())
                .status(event.getStatus())
                .build();
            
            messagingTemplate.convertAndSend("/topic/user-presence", update);
            
            log.info("Successfully broadcasted user presence from Kafka: userId={}, username={}, status={}", 
                event.getUserId(), event.getUsername(), event.getStatus());
        } catch (Exception e) {
            log.error("Failed to handle user presence: {}", raw, e);
        }
    }
}