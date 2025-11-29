package com.lootchat.LootChat.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lootchat.LootChat.dto.*;
import com.lootchat.LootChat.entity.DirectMessageMessage;
import com.lootchat.LootChat.entity.InboxEvent;
import com.lootchat.LootChat.entity.Message;
import com.lootchat.LootChat.repository.DirectMessageMessageRepository;
import com.lootchat.LootChat.repository.InboxEventRepository;
import com.lootchat.LootChat.repository.MessageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Inbox Event Processor.
 * 
 * Processes incoming Kafka messages stored in the inbox table.
 * Ensures exactly-once semantics through idempotency.
 * 
 * Features:
 * - Distributed locking via Redis for multi-pod scaling
 * - Batch processing for efficiency
 * - Exponential backoff retry for failed events
 * - Dead letter handling for exhausted events
 * - Automatic cleanup of old processed events
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class InboxEventProcessor {
    
    private final InboxEventRepository inboxRepository;
    private final InboxService inboxService;
    private final ObjectMapper objectMapper;
    private final MessageRepository messageRepository;
    private final DirectMessageMessageRepository directMessageMessageRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final RedisTemplate<String, String> redisTemplate;
    
    // Configuration
    private static final String LOCK_KEY = "inbox:processor:lock";
    private static final Duration LOCK_DURATION = Duration.ofSeconds(30);
    private static final int BATCH_SIZE = 50;
    private static final int MAX_RETRIES = 5;
    
    // Instance identifier for distributed processing
    private final String instanceId = UUID.randomUUID().toString().substring(0, 8);
    
    /**
     * Process inbox events every 500ms.
     * Uses distributed locking to ensure only one pod processes at a time.
     */
    @Scheduled(fixedDelay = 500)
    public void processInboxEvents() {
        // Try to acquire distributed lock
        Boolean acquired = redisTemplate.opsForValue()
                .setIfAbsent(LOCK_KEY, instanceId, LOCK_DURATION);
        
        if (Boolean.FALSE.equals(acquired)) {
            log.trace("Inbox processor lock held by another instance, skipping");
            return;
        }
        
        try {
            // Extend lock during processing
            redisTemplate.expire(LOCK_KEY, LOCK_DURATION);
            
            List<InboxEvent> events = inboxRepository.findUnprocessedEvents(
                    MAX_RETRIES, PageRequest.of(0, BATCH_SIZE));
            
            if (events.isEmpty()) {
                return;
            }
            
            log.debug("Processing {} inbox events", events.size());
            
            for (InboxEvent event : events) {
                processEvent(event);
                
                // Extend lock if still processing
                redisTemplate.expire(LOCK_KEY, LOCK_DURATION);
            }
            
        } catch (Exception e) {
            log.error("Error in inbox event processor", e);
        } finally {
            // Release lock if we still own it
            String currentHolder = redisTemplate.opsForValue().get(LOCK_KEY);
            if (instanceId.equals(currentHolder)) {
                redisTemplate.delete(LOCK_KEY);
            }
        }
    }
    
    /**
     * Process a single inbox event.
     */
    @Transactional
    protected void processEvent(InboxEvent event) {
        try {
            log.debug("Processing inbox event: id={}, type={}, topic={}", 
                    event.getId(), event.getEventType(), event.getTopic());
            
            // Route to appropriate handler based on topic
            switch (event.getTopic()) {
                case "lootchat.chat.messages":
                    processChannelMessageEvent(event);
                    break;
                case "lootchat.direct.messages":
                    processDirectMessageEvent(event);
                    break;
                case "lootchat.direct.message.reactions":
                    processDirectMessageReactionEvent(event);
                    break;
                case "lootchat.direct.message.edits":
                    processDirectMessageEditEvent(event);
                    break;
                case "lootchat.direct.message.deletions":
                    processDirectMessageDeleteEvent(event);
                    break;
                case "lootchat.presence":
                    processPresenceEvent(event);
                    break;
                default:
                    log.warn("Unknown inbox event topic: {}", event.getTopic());
                    // Mark as processed to avoid infinite retries
                    inboxService.markAsProcessed(event.getId(), instanceId);
                    return;
            }
            
            // Mark as successfully processed
            inboxService.markAsProcessed(event.getId(), instanceId);
            log.debug("Successfully processed inbox event: id={}", event.getId());
            
        } catch (Exception e) {
            log.error("Failed to process inbox event: id={}, error={}", 
                    event.getId(), e.getMessage(), e);
            inboxService.recordFailure(event.getId(), e.getMessage());
            
            if (event.getRetryCount() + 1 >= MAX_RETRIES) {
                log.error("Inbox event exhausted after {} retries: id={}, topic={}", 
                        MAX_RETRIES, event.getId(), event.getTopic());
            }
        }
    }
    
    /**
     * Process channel message events (create, update, delete, reaction).
     */
    private void processChannelMessageEvent(InboxEvent event) throws Exception {
        String payload = event.getPayload();
        JsonNode node = objectMapper.readTree(payload);
        
        // Determine event subtype
        if (node.has("reactionId") && node.has("action") && node.has("emoji")) {
            handleReaction(payload);
        } else if (node.has("messageId") && !node.has("content") && !node.has("reactionId") && node.has("channelId")) {
            handleMessageDelete(payload);
        } else if (node.has("messageId") && node.has("content") && !node.has("reactionId") && !node.has("userId")) {
            handleMessageUpdate(payload);
        } else if (node.has("messageId") && node.has("userId") && node.has("content") && !node.has("reactionId")) {
            handleChatMessage(payload);
        } else if (node.has("userId") && node.has("status") && node.has("username") && !node.has("messageId")) {
            handleUserPresence(payload);
        } else {
            log.warn("Unknown channel message event subtype: {}", payload);
        }
    }
    
    private void handleChatMessage(String payload) throws Exception {
        ChatMessageEvent event = objectMapper.readValue(payload, ChatMessageEvent.class);
        
        if (event.getMessageId() == null) {
            log.warn("ChatMessageEvent without messageId, skipping");
            return;
        }
        
        Message message = messageRepository.findByIdWithUserAndChannel(event.getMessageId())
                .orElse(null);
        
        if (message == null) {
            log.warn("No message found for messageId={}", event.getMessageId());
            return;
        }
        
        MessageResponse response = buildMessageResponse(message);
        
        if (message.getChannel() != null) {
            messagingTemplate.convertAndSend("/topic/channels/" + message.getChannel().getId() + "/messages", response);
        }
        messagingTemplate.convertAndSend("/topic/messages", response);
        
        log.info("Broadcasted message from inbox: messageId={}, channelId={}", 
                response.getId(), message.getChannel() != null ? message.getChannel().getId() : null);
    }
    
    private void handleMessageUpdate(String payload) throws Exception {
        MessageUpdateEvent event = objectMapper.readValue(payload, MessageUpdateEvent.class);
        
        if (event.getMessageId() == null || event.getContent() == null) {
            return;
        }
        
        Message message = messageRepository.findByIdWithUserAndChannel(event.getMessageId())
                .orElse(null);
        
        if (message == null) {
            log.warn("No message found for update: messageId={}", event.getMessageId());
            return;
        }
        
        MessageResponse response = buildMessageResponse(message);
        
        if (event.getChannelId() != null) {
            messagingTemplate.convertAndSend("/topic/channels/" + event.getChannelId() + "/messages", response);
        }
        messagingTemplate.convertAndSend("/topic/messages", response);
        
        log.info("Broadcasted message update from inbox: messageId={}", event.getMessageId());
    }
    
    private void handleMessageDelete(String payload) throws Exception {
        MessageDeleteEvent event = objectMapper.readValue(payload, MessageDeleteEvent.class);
        
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
        
        log.info("Broadcasted message delete from inbox: messageId={}", event.getMessageId());
    }
    
    private void handleReaction(String payload) throws Exception {
        ReactionEvent event = objectMapper.readValue(payload, ReactionEvent.class);
        
        if (event.getReactionId() == null || event.getMessageId() == null) {
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
        
        log.info("Broadcasted reaction {} from inbox: reactionId={}", event.getAction(), event.getReactionId());
    }
    
    private void handleUserPresence(String payload) throws Exception {
        UserPresenceEvent event = objectMapper.readValue(payload, UserPresenceEvent.class);
        
        if (event.getUserId() == null || event.getUsername() == null || event.getStatus() == null) {
            return;
        }
        
        UserPresenceUpdate update = UserPresenceUpdate.builder()
                .userId(event.getUserId())
                .username(event.getUsername())
                .status(event.getStatus())
                .build();
        
        messagingTemplate.convertAndSend("/topic/user-presence", update);
        
        log.info("Broadcasted presence from inbox: userId={}, status={}", 
                event.getUserId(), event.getStatus());
    }
    
    private void processPresenceEvent(InboxEvent event) throws Exception {
        handleUserPresence(event.getPayload());
    }
    
    private void processDirectMessageEvent(InboxEvent event) throws Exception {
        DirectMessageEvent dmEvent = objectMapper.readValue(event.getPayload(), DirectMessageEvent.class);
        
        if (dmEvent.getMessageId() == null) {
            log.warn("DirectMessageEvent without messageId, skipping");
            return;
        }
        
        DirectMessageMessage message = directMessageMessageRepository
                .findByIdWithSenderAndDirectMessage(dmEvent.getMessageId())
                .orElse(null);
        
        if (message == null) {
            log.warn("No DM message found for messageId={}", dmEvent.getMessageId());
            return;
        }
        
        DirectMessageMessageResponse response = buildDirectMessageResponse(message);
        
        messagingTemplate.convertAndSend("/topic/user/" + dmEvent.getSenderId() + "/direct-messages", response);
        messagingTemplate.convertAndSend("/topic/user/" + dmEvent.getRecipientId() + "/direct-messages", response);
        
        log.info("Broadcasted DM from inbox: messageId={}", response.getId());
    }
    
    private void processDirectMessageReactionEvent(InboxEvent event) throws Exception {
        DirectMessageReactionEvent reactionEvent = objectMapper.readValue(
                event.getPayload(), DirectMessageReactionEvent.class);
        
        if (reactionEvent.getReactionId() == null || reactionEvent.getMessageId() == null) {
            return;
        }
        
        DirectMessageReactionResponse response = DirectMessageReactionResponse.builder()
                .id(reactionEvent.getReactionId())
                .emoji(reactionEvent.getEmoji())
                .userId(reactionEvent.getUserId())
                .username(reactionEvent.getUsername())
                .messageId(reactionEvent.getMessageId())
                .createdAt(java.time.LocalDateTime.now())
                .build();
        
        if (reactionEvent.getUser1Id() != null && reactionEvent.getUser2Id() != null) {
            String topic = "add".equals(reactionEvent.getAction()) ? "/reactions" : "/reactions/remove";
            messagingTemplate.convertAndSend("/topic/user/" + reactionEvent.getUser1Id() + 
                    "/direct-messages/" + reactionEvent.getDirectMessageId() + topic, response);
            messagingTemplate.convertAndSend("/topic/user/" + reactionEvent.getUser2Id() + 
                    "/direct-messages/" + reactionEvent.getDirectMessageId() + topic, response);
        }
        
        log.info("Broadcasted DM reaction from inbox: reactionId={}", reactionEvent.getReactionId());
    }
    
    private void processDirectMessageEditEvent(InboxEvent event) throws Exception {
        DirectMessageEditEvent editEvent = objectMapper.readValue(
                event.getPayload(), DirectMessageEditEvent.class);
        
        if (editEvent.getMessageId() == null) {
            return;
        }
        
        DirectMessageMessage message = directMessageMessageRepository
                .findByIdWithSenderAndDirectMessage(editEvent.getMessageId())
                .orElse(null);
        
        if (message == null) {
            log.warn("No DM message found for edit: messageId={}", editEvent.getMessageId());
            return;
        }
        
        DirectMessageMessageResponse response = buildDirectMessageResponse(message);
        
        Long user1Id = message.getDirectMessage().getUser1().getId();
        Long user2Id = message.getDirectMessage().getUser2().getId();
        
        messagingTemplate.convertAndSend("/topic/user/" + user1Id + 
                "/direct-messages/" + editEvent.getDirectMessageId() + "/edits", response);
        messagingTemplate.convertAndSend("/topic/user/" + user2Id + 
                "/direct-messages/" + editEvent.getDirectMessageId() + "/edits", response);
        
        log.info("Broadcasted DM edit from inbox: messageId={}", editEvent.getMessageId());
    }
    
    private void processDirectMessageDeleteEvent(InboxEvent event) throws Exception {
        DirectMessageDeleteEvent deleteEvent = objectMapper.readValue(
                event.getPayload(), DirectMessageDeleteEvent.class);
        
        if (deleteEvent.getMessageId() == null) {
            return;
        }
        
        var deletionPayload = Map.of(
                "id", deleteEvent.getMessageId(),
                "directMessageId", deleteEvent.getDirectMessageId()
        );
        
        messagingTemplate.convertAndSend("/topic/direct-messages/" + 
                deleteEvent.getDirectMessageId() + "/delete", deletionPayload);
        
        log.info("Broadcasted DM delete from inbox: messageId={}", deleteEvent.getMessageId());
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
    
    /**
     * Cleanup old processed events daily at 4 AM.
     * Runs 1 hour after outbox cleanup.
     */
    @Scheduled(cron = "0 0 4 * * ?")
    @Transactional
    public void cleanupOldEvents() {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(7);
        int deleted = inboxRepository.deleteProcessedEventsBefore(cutoff);
        log.info("Cleaned up {} old inbox events processed before {}", deleted, cutoff);
    }
}
