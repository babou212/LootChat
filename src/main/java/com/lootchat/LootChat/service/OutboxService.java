package com.lootchat.LootChat.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lootchat.LootChat.entity.OutboxEvent;
import com.lootchat.LootChat.repository.OutboxEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Centralized Outbox Service for reliable event publishing.
 * 
 * The Transactional Outbox Pattern ensures:
 * 1. Atomicity: DB changes and event creation happen in the same transaction
 * 2. Reliability: Events are persisted even if Kafka is temporarily unavailable
 * 3. Ordering: Events are processed in creation order
 * 4. Retry: Failed events are automatically retried with exponential backoff
 * 
 * Usage:
 * - Call saveEvent() within the same @Transactional method as your DB operation
 * - The OutboxEventProcessor will asynchronously publish to Kafka
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OutboxService {
    
    private final OutboxEventRepository outboxRepository;
    private final ObjectMapper objectMapper;
    
    // Topic constants for consistency
    public static final String TOPIC_CHANNEL_MESSAGES = "lootchat.chat.messages";
    public static final String TOPIC_DIRECT_MESSAGES = "lootchat.direct.messages";
    public static final String TOPIC_DIRECT_REACTIONS = "lootchat.direct.message.reactions";
    public static final String TOPIC_DIRECT_EDITS = "lootchat.direct.message.edits";
    public static final String TOPIC_DIRECT_DELETIONS = "lootchat.direct.message.deletions";
    public static final String TOPIC_PRESENCE = "lootchat.presence";
    
    // Event type constants
    public static final String EVENT_MESSAGE_CREATED = "MESSAGE_CREATED";
    public static final String EVENT_MESSAGE_EDITED = "MESSAGE_EDITED";
    public static final String EVENT_MESSAGE_DELETED = "MESSAGE_DELETED";
    public static final String EVENT_REACTION_ADDED = "REACTION_ADDED";
    public static final String EVENT_REACTION_REMOVED = "REACTION_REMOVED";
    public static final String EVENT_PRESENCE_UPDATED = "PRESENCE_UPDATED";
    
    /**
     * Save an event to the outbox within the current transaction.
     * MUST be called within a @Transactional context.
     *
     * @param eventType Type of event (e.g., MESSAGE_CREATED)
     * @param topic Kafka topic to publish to
     * @param messageKey Kafka message key for partitioning (e.g., channelId)
     * @param payload The event payload object (will be serialized to JSON)
     * @return The saved OutboxEvent
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public OutboxEvent saveEvent(String eventType, String topic, String messageKey, Object payload) {
        try {
            String json = objectMapper.writeValueAsString(payload);
            
            OutboxEvent event = OutboxEvent.builder()
                    .eventType(eventType)
                    .topic(topic)
                    .messageKey(messageKey)
                    .payload(json)
                    .processed(false)
                    .retryCount(0)
                    .build();
            
            OutboxEvent saved = outboxRepository.save(event);
            log.debug("Saved outbox event: type={}, topic={}, key={}, id={}", 
                    eventType, topic, messageKey, saved.getId());
            
            return saved;
            
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize outbox event payload: {}", e.getMessage());
            throw new RuntimeException("Failed to serialize event payload", e);
        }
    }
    
    /**
     * Convenience method for channel message events.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public OutboxEvent saveChannelMessageEvent(String eventType, Long channelId, Object payload) {
        return saveEvent(eventType, TOPIC_CHANNEL_MESSAGES, String.valueOf(channelId), payload);
    }
    
    /**
     * Convenience method for direct message events.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public OutboxEvent saveDirectMessageEvent(String eventType, Long directMessageId, Object payload) {
        return saveEvent(eventType, TOPIC_DIRECT_MESSAGES, String.valueOf(directMessageId), payload);
    }
    
    /**
     * Convenience method for direct message reaction events.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public OutboxEvent saveDirectMessageReactionEvent(Long directMessageId, Object payload) {
        return saveEvent(EVENT_REACTION_ADDED, TOPIC_DIRECT_REACTIONS, String.valueOf(directMessageId), payload);
    }
    
    /**
     * Convenience method for direct message edit events.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public OutboxEvent saveDirectMessageEditEvent(Long directMessageId, Object payload) {
        return saveEvent(EVENT_MESSAGE_EDITED, TOPIC_DIRECT_EDITS, String.valueOf(directMessageId), payload);
    }
    
    /**
     * Convenience method for direct message deletion events.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public OutboxEvent saveDirectMessageDeleteEvent(Long directMessageId, Object payload) {
        return saveEvent(EVENT_MESSAGE_DELETED, TOPIC_DIRECT_DELETIONS, String.valueOf(directMessageId), payload);
    }
    
    /**
     * Get count of pending (unprocessed) events.
     * Useful for monitoring and health checks.
     */
    public long getPendingEventCount() {
        return outboxRepository.countByProcessedFalse();
    }
    
    /**
     * Get count of failed events (exceeded retry limit).
     * Useful for alerting.
     */
    public long getFailedEventCount() {
        return outboxRepository.countByProcessedFalseAndRetryCountGreaterThanEqual(5);
    }
}
