package com.lootchat.LootChat.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * Transactional Outbox Pattern Entity.
 * 
 * Stores events to be published to Kafka after transaction commits.
 * Ensures data integrity: DB changes + event publishing are atomic.
 * 
 * Flow:
 * 1. Service saves entity + OutboxEvent in same @Transactional method
 * 2. Transaction commits (both saved atomically)
 * 3. OutboxEventProcessor polls for unprocessed events
 * 4. Events are published to Kafka
 * 5. Events are marked as processed
 * 
 * Retry logic:
 * - Failed events are retried up to 5 times with exponential backoff
 * - After 5 failures, events are moved to dead letter (prefixed with DLQ_)
 */
@Entity
@Table(name = "outbox_events", indexes = {
    // Primary query: find unprocessed events ordered by creation time
    @Index(name = "idx_outbox_unprocessed", columnList = "processed, createdAt"),
    // Retry query: find failed events that should be retried
    @Index(name = "idx_outbox_retry", columnList = "processed, retryCount, createdAt"),
    // Cleanup query: find old processed events
    @Index(name = "idx_outbox_cleanup", columnList = "processed, processedAt")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OutboxEvent {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, length = 100)
    private String eventType; // e.g., "MESSAGE_CREATED", "REACTION_ADDED", "DLQ_MESSAGE_CREATED"
    
    @Column(nullable = false, length = 10000)
    private String payload; // JSON payload
    
    @Column(length = 100)
    private String topic; // Kafka topic (nullable = use default)
    
    @Column(length = 100)
    private String messageKey; // Kafka message key for partitioning
    
    @Column(nullable = false)
    private LocalDateTime createdAt;
    
    @Column
    private LocalDateTime processedAt;
    
    @Column(nullable = false)
    @Builder.Default
    private Boolean processed = false;
    
    @Column(nullable = false)
    @Builder.Default
    private Integer retryCount = 0;
    
    @Column(length = 500)
    private String lastError;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (retryCount == null) {
            retryCount = 0;
        }
        if (processed == null) {
            processed = false;
        }
    }
    
    /**
     * Check if this event has been moved to dead letter queue.
     */
    public boolean isDeadLetter() {
        return eventType != null && eventType.startsWith("DLQ_");
    }
    
    /**
     * Get the original event type (without DLQ_ prefix).
     */
    public String getOriginalEventType() {
        if (isDeadLetter()) {
            return eventType.substring(4);
        }
        return eventType;
    }
}
