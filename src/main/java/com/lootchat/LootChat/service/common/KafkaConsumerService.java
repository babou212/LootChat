package com.lootchat.LootChat.service.common;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lootchat.LootChat.entity.InboxEvent;
import com.lootchat.LootChat.service.inbox.InboxService;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Kafka Consumer Service using the Inbox Pattern.
 * 
 * This service receives messages from Kafka and stores them in the inbox table
 * for reliable, exactly-once processing. Benefits:
 * 
 * 1. Fast ACK: Messages are acknowledged to Kafka immediately after storing in inbox
 * 2. Deduplication: Duplicate messages are ignored based on topic:partition:offset
 * 3. Resilience: Messages survive consumer restarts
 * 4. Retry: Failed processing is automatically retried
 * 5. Decoupling: WebSocket broadcasting is async, won't slow down Kafka consumption
 * 
 * The actual business logic (WebSocket broadcasting) is handled by InboxEventProcessor.
 */
@Service
public class KafkaConsumerService {

    private static final Logger log = LoggerFactory.getLogger(KafkaConsumerService.class);
    
    private final InboxService inboxService;
    private final ObjectMapper objectMapper;

    public KafkaConsumerService(InboxService inboxService, ObjectMapper objectMapper) {
        this.inboxService = inboxService;
        this.objectMapper = objectMapper;
    }

    /**
     * Consume channel message events and store in inbox.
     */
    @KafkaListener(
        topics = "${app.kafka.topics.chat:lootchat.chat.messages}", 
        groupId = "${spring.kafka.consumer.group-id}",
        concurrency = "${spring.kafka.listener.concurrency:3}"
    )
    public void consumeChannelMessageEvent(ConsumerRecord<String, String> record) {
        log.debug("Kafka received channel message: partition={}, offset={}", 
                record.partition(), record.offset());
        
        try {
            String eventType = detectEventType(record.value());
            Optional<InboxEvent> stored = inboxService.storeEvent(record, eventType);
            
            if (stored.isPresent()) {
                log.debug("Stored channel message in inbox: id={}, type={}", 
                        stored.get().getId(), eventType);
            } else {
                log.debug("Duplicate channel message ignored: partition={}, offset={}", 
                        record.partition(), record.offset());
            }
        } catch (Exception e) {
            log.error("Failed to store channel message in inbox: partition={}, offset={}, error={}", 
                    record.partition(), record.offset(), e.getMessage(), e);
            // Don't rethrow - we want to ACK the message even if inbox storage fails
            // The message will be lost, but we prevent consumer blocking
            // In production, you might want different behavior based on error type
        }
    }

    /**
     * Consume direct message events and store in inbox.
     */
    @KafkaListener(
        topics = "lootchat.direct.messages",
        groupId = "${spring.kafka.consumer.group-id}",
        concurrency = "${spring.kafka.listener.concurrency:3}"
    )
    public void consumeDirectMessageEvent(ConsumerRecord<String, String> record) {
        log.debug("Kafka received DM: partition={}, offset={}", 
                record.partition(), record.offset());
        
        try {
            Optional<InboxEvent> stored = inboxService.storeEvent(record, "DIRECT_MESSAGE");
            
            if (stored.isPresent()) {
                log.debug("Stored DM in inbox: id={}", stored.get().getId());
            }
        } catch (Exception e) {
            log.error("Failed to store DM in inbox: partition={}, offset={}", 
                    record.partition(), record.offset(), e);
        }
    }
    
    /**
     * Consume direct message reaction events and store in inbox.
     */
    @KafkaListener(
        topics = "lootchat.direct.message.reactions",
        groupId = "${spring.kafka.consumer.group-id}",
        concurrency = "${spring.kafka.listener.concurrency:3}"
    )
    public void consumeDirectMessageReactionEvent(ConsumerRecord<String, String> record) {
        log.debug("Kafka received DM reaction: partition={}, offset={}", 
                record.partition(), record.offset());
        
        try {
            Optional<InboxEvent> stored = inboxService.storeEvent(record, "DIRECT_MESSAGE_REACTION");
            
            if (stored.isPresent()) {
                log.debug("Stored DM reaction in inbox: id={}", stored.get().getId());
            }
        } catch (Exception e) {
            log.error("Failed to store DM reaction in inbox: partition={}, offset={}", 
                    record.partition(), record.offset(), e);
        }
    }
    
    /**
     * Consume direct message edit events and store in inbox.
     */
    @KafkaListener(
        topics = "lootchat.direct.message.edits",
        groupId = "${spring.kafka.consumer.group-id}",
        concurrency = "${spring.kafka.listener.concurrency:3}"
    )
    public void consumeDirectMessageEditEvent(ConsumerRecord<String, String> record) {
        log.debug("Kafka received DM edit: partition={}, offset={}", 
                record.partition(), record.offset());
        
        try {
            Optional<InboxEvent> stored = inboxService.storeEvent(record, "DIRECT_MESSAGE_EDIT");
            
            if (stored.isPresent()) {
                log.debug("Stored DM edit in inbox: id={}", stored.get().getId());
            }
        } catch (Exception e) {
            log.error("Failed to store DM edit in inbox: partition={}, offset={}", 
                    record.partition(), record.offset(), e);
        }
    }
    
    /**
     * Consume direct message deletion events and store in inbox.
     */
    @KafkaListener(
        topics = "lootchat.direct.message.deletions",
        groupId = "${spring.kafka.consumer.group-id}",
        concurrency = "${spring.kafka.listener.concurrency:3}"
    )
    public void consumeDirectMessageDeleteEvent(ConsumerRecord<String, String> record) {
        log.debug("Kafka received DM delete: partition={}, offset={}", 
                record.partition(), record.offset());
        
        try {
            Optional<InboxEvent> stored = inboxService.storeEvent(record, "DIRECT_MESSAGE_DELETE");
            
            if (stored.isPresent()) {
                log.debug("Stored DM delete in inbox: id={}", stored.get().getId());
            }
        } catch (Exception e) {
            log.error("Failed to store DM delete in inbox: partition={}, offset={}", 
                    record.partition(), record.offset(), e);
        }
    }
    
    /**
     * Consume presence events and store in inbox.
     */
    @KafkaListener(
        topics = "lootchat.presence",
        groupId = "${spring.kafka.consumer.group-id}",
        concurrency = "${spring.kafka.listener.concurrency:3}"
    )
    public void consumePresenceEvent(ConsumerRecord<String, String> record) {
        log.debug("Kafka received presence: partition={}, offset={}", 
                record.partition(), record.offset());
        
        try {
            Optional<InboxEvent> stored = inboxService.storeEvent(record, "PRESENCE_UPDATED");
            
            if (stored.isPresent()) {
                log.debug("Stored presence in inbox: id={}", stored.get().getId());
            }
        } catch (Exception e) {
            log.error("Failed to store presence in inbox: partition={}, offset={}", 
                    record.partition(), record.offset(), e);
        }
    }
    
    /**
     * Detect event type from payload for channel messages.
     * This helps with routing in the inbox processor.
     */
    private String detectEventType(String payload) {
        try {
            JsonNode node = objectMapper.readTree(payload);
            
            if (node.has("reactionId") && node.has("action") && node.has("emoji")) {
                return "add".equals(node.get("action").asText()) ? 
                        "REACTION_ADDED" : "REACTION_REMOVED";
            } else if (node.has("messageId") && !node.has("content") && !node.has("reactionId") && node.has("channelId")) {
                return "MESSAGE_DELETED";
            } else if (node.has("messageId") && node.has("content") && !node.has("reactionId") && !node.has("userId")) {
                return "MESSAGE_EDITED";
            } else if (node.has("messageId") && node.has("userId") && node.has("content")) {
                return "MESSAGE_CREATED";
            } else if (node.has("userId") && node.has("status") && node.has("username")) {
                return "PRESENCE_UPDATED";
            }
            
            return "UNKNOWN";
        } catch (Exception e) {
            log.warn("Failed to detect event type: {}", e.getMessage());
            return "UNKNOWN";
        }
    }
}