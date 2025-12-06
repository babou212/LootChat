package com.lootchat.LootChat.service.inbox;

import com.lootchat.LootChat.entity.InboxEvent;
import com.lootchat.LootChat.repository.InboxEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

/**
 * Inbox Service for reliable Kafka message consumption.
 * 
 * The Inbox Pattern ensures exactly-once processing semantics:
 * 1. Store incoming message in database with unique idempotency key
 * 2. ACK to Kafka immediately (fast response, prevents redelivery timeout)
 * 3. Process message asynchronously via InboxEventProcessor
 * 4. Deduplicate by checking idempotency key
 * 
 * Usage:
 * - Kafka consumer calls storeEvent() for each incoming message
 * - Returns true if message was stored (new), false if duplicate
 * - InboxEventProcessor handles the actual business logic
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class InboxService {
    
    private final InboxEventRepository inboxRepository;
    
    // Configuration
    private static final int MAX_RETRIES = 5;
    
    /**
     * Store an incoming Kafka message in the inbox.
     * Uses ConsumerRecord to build idempotency key from topic:partition:offset.
     * 
     * @param record The Kafka consumer record
     * @param eventType The type of event (e.g., MESSAGE_CREATED)
     * @return The stored InboxEvent, or empty if duplicate
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Optional<InboxEvent> storeEvent(ConsumerRecord<String, String> record, String eventType) {
        String idempotencyKey = buildIdempotencyKey(record);
        
        // Check for duplicate first (fast path)
        if (inboxRepository.existsByIdempotencyKey(idempotencyKey)) {
            log.debug("Duplicate inbox event ignored: key={}", idempotencyKey);
            return Optional.empty();
        }
        
        try {
            InboxEvent event = InboxEvent.builder()
                    .idempotencyKey(idempotencyKey)
                    .eventType(eventType)
                    .payload(record.value())
                    .topic(record.topic())
                    .kafkaPartition(record.partition())
                    .kafkaOffset(record.offset())
                    .messageKey(record.key())
                    .receivedAt(LocalDateTime.now())
                    .processed(false)
                    .retryCount(0)
                    .build();
            
            InboxEvent saved = inboxRepository.save(event);
            log.debug("Stored inbox event: id={}, key={}, type={}, topic={}", 
                    saved.getId(), idempotencyKey, eventType, record.topic());
            
            return Optional.of(saved);
            
        } catch (DataIntegrityViolationException e) {
            // Race condition: another consumer stored the same event
            log.debug("Concurrent duplicate inbox event ignored: key={}", idempotencyKey);
            return Optional.empty();
        }
    }
    
    /**
     * Store an event with a custom idempotency key.
     * Use this when you have a business-level unique identifier.
     * 
     * @param idempotencyKey Custom unique identifier
     * @param eventType The type of event
     * @param topic Source topic
     * @param payload The raw JSON payload
     * @return The stored InboxEvent, or empty if duplicate
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Optional<InboxEvent> storeEvent(String idempotencyKey, String eventType, 
                                           String topic, String payload) {
        if (inboxRepository.existsByIdempotencyKey(idempotencyKey)) {
            log.debug("Duplicate inbox event ignored: key={}", idempotencyKey);
            return Optional.empty();
        }
        
        try {
            InboxEvent event = InboxEvent.builder()
                    .idempotencyKey(idempotencyKey)
                    .eventType(eventType)
                    .payload(payload)
                    .topic(topic)
                    .receivedAt(LocalDateTime.now())
                    .processed(false)
                    .retryCount(0)
                    .build();
            
            InboxEvent saved = inboxRepository.save(event);
            log.debug("Stored inbox event: id={}, key={}, type={}", 
                    saved.getId(), idempotencyKey, eventType);
            
            return Optional.of(saved);
            
        } catch (DataIntegrityViolationException e) {
            log.debug("Concurrent duplicate inbox event ignored: key={}", idempotencyKey);
            return Optional.empty();
        }
    }
    
    /**
     * Check if an event with the given idempotency key exists.
     */
    public boolean isDuplicate(String idempotencyKey) {
        return inboxRepository.existsByIdempotencyKey(idempotencyKey);
    }
    
    /**
     * Check if a Kafka record has already been processed.
     */
    public boolean isDuplicate(ConsumerRecord<String, String> record) {
        return isDuplicate(buildIdempotencyKey(record));
    }
    
    /**
     * Build idempotency key from Kafka consumer record.
     * Format: topic:partition:offset
     */
    public String buildIdempotencyKey(ConsumerRecord<String, String> record) {
        return String.format("%s:%d:%d", record.topic(), record.partition(), record.offset());
    }
    
    /**
     * Mark an event as successfully processed.
     */
    @Transactional
    public void markAsProcessed(Long eventId, String processorInstance) {
        inboxRepository.markAsProcessed(eventId, LocalDateTime.now(), processorInstance);
        log.debug("Marked inbox event as processed: id={}, processor={}", eventId, processorInstance);
    }
    
    /**
     * Record a processing failure for retry.
     */
    @Transactional
    public void recordFailure(Long eventId, String error) {
        String truncatedError = error != null && error.length() > 1000 ? error.substring(0, 1000) : error;
        inboxRepository.incrementRetryCount(eventId, truncatedError);
        log.warn("Recorded inbox event failure: id={}, error={}", eventId, truncatedError);
    }
    
    /**
     * Get count of pending (unprocessed) events.
     */
    public long getPendingEventCount() {
        return inboxRepository.countByProcessedFalse();
    }
    
    /**
     * Get count of pending events by topic.
     */
    public long getPendingEventCount(String topic) {
        return inboxRepository.countByProcessedFalseAndTopic(topic);
    }
    
    /**
     * Get count of exhausted events (exceeded max retries).
     */
    public long getExhaustedEventCount() {
        return inboxRepository.countExhaustedEvents(MAX_RETRIES);
    }
    
    /**
     * Get max retries configuration.
     */
    public int getMaxRetries() {
        return MAX_RETRIES;
    }
}
