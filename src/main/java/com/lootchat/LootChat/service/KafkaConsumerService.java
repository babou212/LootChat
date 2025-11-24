package com.lootchat.LootChat.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lootchat.LootChat.dto.*;
import com.lootchat.LootChat.entity.DirectMessageMessage;
import com.lootchat.LootChat.entity.Message;
import com.lootchat.LootChat.repository.DirectMessageMessageRepository;
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
    private final DirectMessageMessageRepository directMessageMessageRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public KafkaConsumerService(ObjectMapper objectMapper, MessageRepository messageRepository,
                                DirectMessageMessageRepository directMessageMessageRepository,
                                SimpMessagingTemplate messagingTemplate) {
        this.objectMapper = objectMapper;
        this.messageRepository = messageRepository;
        this.directMessageMessageRepository = directMessageMessageRepository;
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
                .replyToMessageId(message.getReplyToMessage() != null ? message.getReplyToMessage().getId() : null)
                .replyToUsername(message.getReplyToUsername())
                .replyToContent(message.getReplyToContent())
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

    @KafkaListener(
        topics = "lootchat.direct.messages",
        groupId = "${spring.kafka.consumer.group-id}",
        concurrency = "${spring.kafka.listener.concurrency:3}"
    )
    public void consumeDirectMessageEvent(String raw) {
        log.debug("Kafka consumed DM payload: {}", raw);
        
        try {
            DirectMessageEvent event = objectMapper.readValue(raw, DirectMessageEvent.class);
            log.debug("Handling DirectMessageEvent: {}", event);
            
            if (event.getMessageId() == null) {
                log.warn("Skipping DirectMessageEvent without messageId: {}", raw);
                return;
            }
            
            DirectMessageMessage message = directMessageMessageRepository
                    .findByIdWithSenderAndDirectMessage(event.getMessageId())
                    .orElse(null);
            
            if (message == null) {
                log.warn("No DM message found for event with messageId={}", event.getMessageId());
                return;
            }
            
            DirectMessageMessageResponse response = buildDirectMessageResponse(message);
            
            // Send to both users
            messagingTemplate.convertAndSend("/topic/user/" + event.getSenderId() + "/direct-messages", response);
            messagingTemplate.convertAndSend("/topic/user/" + event.getRecipientId() + "/direct-messages", response);
            
            log.info("Successfully broadcasted DM from Kafka: messageId={}, dmId={}", 
                response.getId(), message.getDirectMessage().getId());
        } catch (Exception e) {
            log.error("Failed to handle direct message: {}", raw, e);
        }
    }
    
    private DirectMessageMessageResponse buildDirectMessageResponse(DirectMessageMessage message) {
        return DirectMessageMessageResponse.builder()
                .id(message.getId())
                .content(message.getContent())
                .senderId(message.getSender().getId())
                .senderUsername(message.getSender().getUsername())
                .senderAvatar(message.getSender().getAvatar())
                .directMessageId(message.getDirectMessage().getId())
                .imageUrl(message.getImageUrl())
                .imageFilename(message.getImageFilename())
                .replyToMessageId(message.getReplyToMessage() != null ? message.getReplyToMessage().getId() : null)
                .replyToUsername(message.getReplyToUsername())
                .replyToContent(message.getReplyToContent())
                .isRead(message.isRead())
                .createdAt(message.getCreatedAt())
                .updatedAt(message.getUpdatedAt())
                .reactions(List.of())
                .build();
    }
    
    @KafkaListener(
        topics = "lootchat.direct.message.reactions",
        groupId = "${spring.kafka.consumer.group-id}",
        concurrency = "${spring.kafka.listener.concurrency:3}"
    )
    public void consumeDirectMessageReactionEvent(String raw) {
        log.debug("Kafka consumed DM reaction payload: {}", raw);
        
        try {
            DirectMessageReactionEvent event = objectMapper.readValue(raw, DirectMessageReactionEvent.class);
            log.debug("Handling DirectMessageReactionEvent: {}", event);
            
            if (event.getReactionId() == null || event.getMessageId() == null || 
                event.getAction() == null || event.getEmoji() == null) {
                return;
            }
            
            DirectMessageReactionResponse response = DirectMessageReactionResponse.builder()
                .id(event.getReactionId())
                .emoji(event.getEmoji())
                .userId(event.getUserId())
                .username(event.getUsername())
                .messageId(event.getMessageId())
                .createdAt(java.time.LocalDateTime.now())
                .build();
            
            // Use user IDs from event to avoid lazy loading issues
            if (event.getUser1Id() != null && event.getUser2Id() != null) {
                String topic = "add".equals(event.getAction()) ? "/reactions" : "/reactions/remove";
                messagingTemplate.convertAndSend("/topic/user/" + event.getUser1Id() + "/direct-messages/" + event.getDirectMessageId() + topic, response);
                messagingTemplate.convertAndSend("/topic/user/" + event.getUser2Id() + "/direct-messages/" + event.getDirectMessageId() + topic, response);
            }
            
            log.info("Successfully broadcasted DM reaction {} from Kafka: reactionId={}, messageId={}, dmId={}", 
                event.getAction(), event.getReactionId(), event.getMessageId(), event.getDirectMessageId());
        } catch (Exception e) {
            log.error("Failed to handle DM reaction: {}", raw, e);
        }
    }
    
    @KafkaListener(
        topics = "lootchat.direct.message.edits",
        groupId = "${spring.kafka.consumer.group-id}",
        concurrency = "${spring.kafka.listener.concurrency:3}"
    )
    public void consumeDirectMessageEditEvent(String raw) {
        log.debug("Kafka consumed DM edit payload: {}", raw);
        
        try {
            DirectMessageEditEvent event = objectMapper.readValue(raw, DirectMessageEditEvent.class);
            log.debug("Handling DirectMessageEditEvent: {}", event);
            
            if (event.getMessageId() == null || event.getContent() == null) {
                return;
            }
            
            DirectMessageMessage message = directMessageMessageRepository
                    .findByIdWithSenderAndDirectMessage(event.getMessageId())
                    .orElse(null);
            
            if (message == null) {
                log.warn("No DM message found for edit event with messageId={}", event.getMessageId());
                return;
            }
            
            DirectMessageMessageResponse response = buildDirectMessageResponse(message);
            
            Long user1Id = message.getDirectMessage().getUser1().getId();
            Long user2Id = message.getDirectMessage().getUser2().getId();
            
            messagingTemplate.convertAndSend("/topic/user/" + user1Id + "/direct-messages/" + event.getDirectMessageId() + "/edits", response);
            messagingTemplate.convertAndSend("/topic/user/" + user2Id + "/direct-messages/" + event.getDirectMessageId() + "/edits", response);
            
            log.info("Successfully broadcasted DM edit from Kafka: messageId={}, dmId={}", 
                event.getMessageId(), event.getDirectMessageId());
        } catch (Exception e) {
            log.error("Failed to handle DM edit: {}", raw, e);
        }
    }
    
    @KafkaListener(
        topics = "lootchat.direct.message.deletions",
        groupId = "${spring.kafka.consumer.group-id}",
        concurrency = "${spring.kafka.listener.concurrency:3}"
    )
    public void consumeDirectMessageDeleteEvent(String raw) {
        log.debug("Kafka consumed DM delete payload: {}", raw);
        
        try {
            DirectMessageDeleteEvent event = objectMapper.readValue(raw, DirectMessageDeleteEvent.class);
            log.debug("Handling DirectMessageDeleteEvent: {}", event);
            
            if (event.getMessageId() == null || event.getDirectMessageId() == null) {
                return;
            }
            
            var deletionPayload = Map.of(
                "id", event.getMessageId(),
                "directMessageId", event.getDirectMessageId()
            );
            
            // We don't have access to the DM users anymore since message is deleted
            // So we'll broadcast to a general DM deletion topic
            messagingTemplate.convertAndSend("/topic/direct-messages/" + event.getDirectMessageId() + "/delete", deletionPayload);
            
            log.info("Successfully broadcasted DM delete from Kafka: messageId={}, dmId={}", 
                event.getMessageId(), event.getDirectMessageId());
        } catch (Exception e) {
            log.error("Failed to handle DM delete: {}", raw, e);
        }
    }
}