package com.lootchat.LootChat.service.inbox;

import com.lootchat.LootChat.entity.OutboxEvent;
import com.lootchat.LootChat.repository.OutboxEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Transactional Outbox Processor with Kafka Exactly-Once Semantics.
 * 
 * Uses Kafka transactions to ensure exactly-once delivery:
 * - Messages are sent within a Kafka transaction
 * - Either all messages in the batch are committed or none
 * - Consumers with read_committed isolation only see committed messages
 * 
 * Multi-pod safety:
 * - Uses Redis distributed lock to prevent duplicate processing
 * - Only one pod processes events at a time
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TransactionalOutboxProcessor {
    
    private final OutboxEventRepository outboxRepository;
    private final KafkaTemplate<String, String> kafkaTemplate;
    private final RedisTemplate<String, String> redisTemplate;
    
    private static final String LOCK_KEY = "outbox:processor:lock";
    private static final Duration LOCK_DURATION = Duration.ofSeconds(30);
    private static final int BATCH_SIZE = 50;
    private static final int MAX_RETRIES = 5;
    
    /**
     * Process outbox events within a Kafka transaction.
     * All events in a batch are committed atomically to Kafka.
     * Uses distributed lock to ensure only one pod processes at a time.
     */
    @Scheduled(fixedDelay = 500)
    public void processOutboxEvents() {
        // Try to acquire distributed lock
        Boolean acquired = redisTemplate.opsForValue()
                .setIfAbsent(LOCK_KEY, "processing", LOCK_DURATION);
        
        if (Boolean.FALSE.equals(acquired)) {
            // Another pod is processing
            return;
        }
        
        try {
            doProcessOutboxEvents();
        } finally {
            // Release lock
            redisTemplate.delete(LOCK_KEY);
        }
    }
    
    private void doProcessOutboxEvents() {
        List<OutboxEvent> events = outboxRepository.findUnprocessedEvents()
                .stream()
                .filter(e -> !e.isDeadLetter())
                .limit(BATCH_SIZE)
                .toList();
        
        if (events.isEmpty()) {
            return;
        }
        
        log.debug("Processing {} outbox events with Kafka transaction", events.size());
        
        try {
            // Execute all sends within a single Kafka transaction
            kafkaTemplate.executeInTransaction(ops -> {
                for (OutboxEvent event : events) {
                    String topic = event.getTopic() != null 
                            ? event.getTopic() 
                            : "lootchat.chat.messages";
                    
                    ops.send(topic, event.getMessageKey(), event.getPayload());
                }
                return null;
            });
            
            // Transaction committed successfully - mark all events as processed
            markEventsAsProcessed(events);
            
            log.debug("Successfully published {} events in transaction", events.size());
            
        } catch (Exception e) {
            log.error("Kafka transaction failed for batch of {} events: {}", 
                    events.size(), e.getMessage());
            
            // Transaction was aborted - increment retry counts
            incrementRetryCountsForBatch(events, e.getMessage());
        }
    }
    
    @Transactional
    protected void markEventsAsProcessed(List<OutboxEvent> events) {
        LocalDateTime now = LocalDateTime.now();
        for (OutboxEvent event : events) {
            event.setProcessed(true);
            event.setProcessedAt(now);
            event.setLastError(null);
        }
        outboxRepository.saveAll(events);
    }
    
    @Transactional
    protected void incrementRetryCountsForBatch(List<OutboxEvent> events, String error) {
        for (OutboxEvent event : events) {
            int newRetryCount = event.getRetryCount() + 1;
            event.setRetryCount(newRetryCount);
            event.setLastError(truncateError(error));
            
            if (newRetryCount >= MAX_RETRIES) {
                event.setEventType("DLQ_" + event.getEventType());
                log.error("Event {} moved to DLQ after {} retries", event.getId(), MAX_RETRIES);
            }
        }
        outboxRepository.saveAll(events);
    }
    
    /**
     * Retry failed events with exponential backoff.
     * Uses distributed lock to ensure only one pod retries at a time.
     */
    @Scheduled(fixedDelay = 10000)
    public void retryFailedEvents() {
        Boolean acquired = redisTemplate.opsForValue()
                .setIfAbsent(LOCK_KEY + ":retry", "retrying", Duration.ofSeconds(60));
        
        if (Boolean.FALSE.equals(acquired)) {
            return;
        }
        
        try {
            doRetryFailedEvents();
        } finally {
            redisTemplate.delete(LOCK_KEY + ":retry");
        }
    }
    
    private void doRetryFailedEvents() {
        List<OutboxEvent> failedEvents = outboxRepository.findByProcessedFalseOrderByCreatedAtAsc()
                .stream()
                .filter(e -> e.getRetryCount() > 0 && e.getRetryCount() < MAX_RETRIES)
                .filter(e -> !e.isDeadLetter())
                .filter(this::shouldRetry)
                .limit(20)
                .toList();
        
        if (failedEvents.isEmpty()) {
            return;
        }
        
        log.info("Retrying {} failed events with Kafka transaction", failedEvents.size());
        
        try {
            kafkaTemplate.executeInTransaction(ops -> {
                for (OutboxEvent event : failedEvents) {
                    String topic = event.getTopic() != null 
                            ? event.getTopic() 
                            : "lootchat.chat.messages";
                    ops.send(topic, event.getMessageKey(), event.getPayload());
                }
                return null;
            });
            
            markEventsAsProcessed(failedEvents);
            
        } catch (Exception e) {
            log.error("Retry transaction failed: {}", e.getMessage());
            incrementRetryCountsForBatch(failedEvents, e.getMessage());
        }
    }
    
    private boolean shouldRetry(OutboxEvent event) {
        // Exponential backoff: 2^retryCount seconds
        long backoffSeconds = (long) Math.pow(2, event.getRetryCount());
        LocalDateTime retryAfter = event.getCreatedAt().plusSeconds(backoffSeconds);
        return LocalDateTime.now().isAfter(retryAfter);
    }
    
    /**
     * Cleanup old processed events.
     */
    @Scheduled(cron = "0 0 3 * * *")
    @Transactional
    public void cleanupOldEvents() {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(7);
        outboxRepository.deleteByProcessedTrueAndProcessedAtBefore(cutoff);
        log.info("Cleaned up outbox events processed before {}", cutoff);
    }
    
    /**
     * Report DLQ events for alerting.
     */
    @Scheduled(cron = "0 0 * * * *")
    public void reportDeadLetterEvents() {
        long dlqCount = outboxRepository.countByProcessedFalseAndRetryCountGreaterThanEqual(MAX_RETRIES);
        if (dlqCount > 0) {
            log.warn("ALERT: {} outbox events in dead letter queue", dlqCount);
        }
    }
    
    private String truncateError(String error) {
        if (error == null) return null;
        return error.length() > 500 ? error.substring(0, 500) : error;
    }
}
