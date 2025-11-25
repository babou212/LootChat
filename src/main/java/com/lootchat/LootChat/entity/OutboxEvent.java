package com.lootchat.LootChat.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * Transactional Outbox Pattern
 * Stores events to be published to Kafka after transaction commits
 * Ensures data integrity: DB changes + event publishing are atomic
 */
@Entity
@Table(name = "outbox_events")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OutboxEvent {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false)
    private String eventType; // e.g., "MESSAGE_CREATED", "REACTION_ADDED"
    
    @Column(nullable = false, length = 10000)
    private String payload; // JSON payload
    
    @Column
    private String topic; // Kafka topic (nullable = use default)
    
    @Column
    private String messageKey; // Kafka message key for partitioning
    
    @Column(nullable = false)
    private LocalDateTime createdAt;
    
    @Column
    private LocalDateTime processedAt;
    
    @Column(nullable = false)
    @Builder.Default
    private Boolean processed = false;
    
    @Column
    private Integer retryCount;
    
    @Column
    private String lastError;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (retryCount == null) {
            retryCount = 0;
        }
    }
}
