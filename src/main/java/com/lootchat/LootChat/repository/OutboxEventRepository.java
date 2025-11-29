package com.lootchat.LootChat.repository;

import com.lootchat.LootChat.entity.OutboxEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface OutboxEventRepository extends JpaRepository<OutboxEvent, Long> {
    
    /**
     * Find unprocessed events ordered by creation time.
     * Uses LIMIT to prevent loading too many events at once.
     */
    @Query("SELECT e FROM OutboxEvent e WHERE e.processed = false ORDER BY e.createdAt ASC LIMIT 100")
    List<OutboxEvent> findUnprocessedEvents();
    
    /**
     * Find unprocessed events ordered by creation time (legacy method for compatibility)
     */
    List<OutboxEvent> findByProcessedFalseOrderByCreatedAtAsc();
    
    /**
     * Find failed events that should be retried (max 5 retries, with backoff)
     */
    @Query("SELECT e FROM OutboxEvent e WHERE e.processed = false AND e.retryCount < 5 AND e.createdAt < :before ORDER BY e.createdAt ASC LIMIT 50")
    List<OutboxEvent> findRetryableEvents(LocalDateTime before);
    
    /**
     * Find events that have permanently failed (exceeded retry limit)
     */
    @Query("SELECT e FROM OutboxEvent e WHERE e.processed = false AND e.retryCount >= 5 ORDER BY e.createdAt ASC")
    List<OutboxEvent> findDeadLetterEvents();
    
    /**
     * Count pending (unprocessed) events - for monitoring
     */
    long countByProcessedFalse();
    
    /**
     * Count failed events (exceeded retry limit) - for alerting
     */
    long countByProcessedFalseAndRetryCountGreaterThanEqual(int retryCount);
    
    /**
     * Clean up old processed events (for maintenance)
     */
    void deleteByProcessedTrueAndProcessedAtBefore(LocalDateTime before);
    
    /**
     * Move permanently failed events to dead letter (mark for manual review)
     */
    @Modifying
    @Query("UPDATE OutboxEvent e SET e.eventType = CONCAT('DLQ_', e.eventType) WHERE e.processed = false AND e.retryCount >= :maxRetries")
    void markDeadLetterEvents(int maxRetries);
}
