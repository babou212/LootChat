package com.lootchat.LootChat.service;

import com.lootchat.LootChat.entity.OutboxEvent;
import com.lootchat.LootChat.repository.OutboxEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Outbox Pattern Processor
 * Asynchronously publishes events to Kafka after transaction commits
 * Ensures eventual consistency and fault tolerance
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OutboxEventProcessor {
    
    private final OutboxEventRepository outboxRepository;
    private final KafkaTemplate<String, String> kafkaTemplate;
    
    /**
     * Process outbox events every 100ms
     * Fast enough for real-time feel, efficient batching
     */
    @Scheduled(fixedDelay = 100)
    @Transactional
    public void processOutboxEvents() {
        List<OutboxEvent> events = outboxRepository.findByProcessedFalseOrderByCreatedAtAsc();
        
        if (events.isEmpty()) {
            return;
        }
        
        log.debug("Processing {} outbox events", events.size());
        
        for (OutboxEvent event : events) {
            try {
                publishToKafka(event);
                event.setProcessed(true);
                event.setProcessedAt(LocalDateTime.now());
                outboxRepository.save(event);
                
            } catch (Exception e) {
                log.error("Failed to publish outbox event {}: {}", event.getId(), e.getMessage());
                event.setRetryCount(event.getRetryCount() + 1);
                event.setLastError(e.getMessage());
                outboxRepository.save(event);
            }
        }
    }
    
    /**
     * Retry failed events every 30 seconds
     */
    @Scheduled(fixedDelay = 30000)
    @Transactional
    public void retryFailedEvents() {
        LocalDateTime retryBefore = LocalDateTime.now().minusSeconds(30);
        List<OutboxEvent> failedEvents = outboxRepository.findRetryableEvents(retryBefore);
        
        if (!failedEvents.isEmpty()) {
            log.info("Retrying {} failed outbox events", failedEvents.size());
            
            for (OutboxEvent event : failedEvents) {
                try {
                    publishToKafka(event);
                    event.setProcessed(true);
                    event.setProcessedAt(LocalDateTime.now());
                    event.setLastError(null);
                    outboxRepository.save(event);
                    
                } catch (Exception e) {
                    log.warn("Retry failed for outbox event {}: {}", event.getId(), e.getMessage());
                    event.setRetryCount(event.getRetryCount() + 1);
                    event.setLastError(e.getMessage());
                    outboxRepository.save(event);
                }
            }
        }
    }
    
    /**
     * Clean up old processed events daily (keep last 7 days)
     */
    @Scheduled(cron = "0 0 3 * * *") // 3 AM daily
    @Transactional
    public void cleanupOldEvents() {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(7);
        try {
            outboxRepository.deleteByProcessedTrueAndProcessedAtBefore(cutoff);
            log.info("Cleaned up outbox events processed before {}", cutoff);
        } catch (Exception e) {
            log.error("Failed to cleanup old outbox events", e);
        }
    }
    
    private void publishToKafka(OutboxEvent event) {
        String topic = event.getTopic() != null ? event.getTopic() : "lootchat.chat.messages";
        
        kafkaTemplate.send(topic, event.getMessageKey(), event.getPayload())
            .whenComplete((result, ex) -> {
                if (ex != null) {
                    throw new RuntimeException("Kafka publish failed: " + ex.getMessage(), ex);
                }
                log.debug("Published outbox event {} to Kafka topic {}", event.getId(), topic);
            });
    }
}
