package com.lootchat.LootChat.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * Inbox Pattern Entity.
 * 
 * Stores incoming Kafka messages for idempotent processing.
 * Ensures exactly-once semantics: messages are deduplicated by idempotencyKey.
 * 
 * Flow:
 * 1. Kafka consumer receives message
 * 2. Message is stored in inbox table with unique idempotencyKey
 * 3. If duplicate (same idempotencyKey), message is skipped (ACK returned)
 * 4. InboxEventProcessor picks up unprocessed events
 * 5. Business logic handlers process the events
 * 6. Events are marked as processed
 * 
 * Benefits:
 * - Exactly-once processing semantics
 * - Decoupling: fast ACK to Kafka, processing happens async
 * - Resilience: survives consumer restarts
 * - Retry: failed events can be retried
 * - Audit trail: all received messages are logged
 */
@Entity
@Table(name = "inbox_events", indexes = {
    // Deduplication: fast lookup by idempotency key
    @Index(name = "idx_inbox_idempotency", columnList = "idempotencyKey", unique = true),
    // Processing query: find unprocessed events ordered by creation time
    @Index(name = "idx_inbox_unprocessed", columnList = "processed, createdAt"),
    // Retry query: find failed events that should be retried
    @Index(name = "idx_inbox_retry", columnList = "processed, retryCount, createdAt"),
    // Cleanup query: find old processed events
    @Index(name = "idx_inbox_cleanup", columnList = "processed, processedAt"),
    // Topic filtering
    @Index(name = "idx_inbox_topic", columnList = "topic, processed")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InboxEvent {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    /**
     * Unique identifier for deduplication.
     * Format: {topic}:{partition}:{offset} or custom business key.
     * This ensures exactly-once processing even if Kafka delivers the same message multiple times.
     */
    @Column(nullable = false, length = 255, unique = true)
    private String idempotencyKey;
    
    @Column(nullable = false, length = 100)
    private String eventType; // e.g., "MESSAGE_CREATED", "REACTION_ADDED"
    
    @Column(nullable = false, length = 10000)
    private String payload; // Original JSON payload from Kafka
    
    @Column(nullable = false, length = 100)
    private String topic; // Source Kafka topic
    
    @Column
    private Integer kafkaPartition; // Source Kafka partition
    
    @Column
    private Long kafkaOffset; // Source Kafka offset
    
    @Column(length = 100)
    private String messageKey; // Kafka message key
    
    @Column(nullable = false)
    private LocalDateTime receivedAt; // When message was received from Kafka
    
    @Column(nullable = false)
    private LocalDateTime createdAt; // When record was created in DB
    
    @Column
    private LocalDateTime processedAt; // When message was successfully processed
    
    @Column(nullable = false)
    @Builder.Default
    private Boolean processed = false;
    
    @Column(nullable = false)
    @Builder.Default
    private Integer retryCount = 0;
    
    @Column(length = 1000)
    private String lastError; // Last error message if processing failed
    
    @Column(length = 100)
    private String processorInstance; // Which instance processed this (for debugging)
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (receivedAt == null) {
            receivedAt = LocalDateTime.now();
        }
        if (retryCount == null) {
            retryCount = 0;
        }
        if (processed == null) {
            processed = false;
        }
    }
    
    /**
     * Check if this event has exhausted its retries.
     */
    public boolean isExhausted(int maxRetries) {
        return retryCount >= maxRetries;
    }
    
    /**
     * Increment retry count and set error message.
     */
    public void recordFailure(String error) {
        this.retryCount = (this.retryCount == null ? 0 : this.retryCount) + 1;
        this.lastError = error != null && error.length() > 1000 ? error.substring(0, 1000) : error;
    }
    
    /**
     * Mark as successfully processed.
     */
    public void markProcessed(String processorInstance) {
        this.processed = true;
        this.processedAt = LocalDateTime.now();
        this.processorInstance = processorInstance;
        this.lastError = null;
    }
}
