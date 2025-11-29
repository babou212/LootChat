package com.lootchat.LootChat.repository;

import com.lootchat.LootChat.entity.InboxEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Repository for InboxEvent persistence.
 * Supports the Inbox Pattern for exactly-once Kafka message processing.
 */
@Repository
public interface InboxEventRepository extends JpaRepository<InboxEvent, Long> {
    
    /**
     * Check if an event with the given idempotency key already exists.
     * Used for deduplication before inserting.
     */
    boolean existsByIdempotencyKey(String idempotencyKey);
    
    /**
     * Find event by idempotency key.
     */
    Optional<InboxEvent> findByIdempotencyKey(String idempotencyKey);
    
    /**
     * Find unprocessed events ordered by creation time.
     * Used by the inbox processor.
     */
    @Query("SELECT e FROM InboxEvent e WHERE e.processed = false " +
           "AND e.retryCount < :maxRetries ORDER BY e.createdAt ASC")
    List<InboxEvent> findUnprocessedEvents(@Param("maxRetries") int maxRetries, 
                                            org.springframework.data.domain.Pageable pageable);
    
    /**
     * Find unprocessed events for a specific topic.
     */
    @Query("SELECT e FROM InboxEvent e WHERE e.processed = false " +
           "AND e.topic = :topic AND e.retryCount < :maxRetries ORDER BY e.createdAt ASC")
    List<InboxEvent> findUnprocessedEventsByTopic(@Param("topic") String topic,
                                                   @Param("maxRetries") int maxRetries,
                                                   org.springframework.data.domain.Pageable pageable);
    
    /**
     * Find events that need retry (failed but not exhausted).
     */
    @Query("SELECT e FROM InboxEvent e WHERE e.processed = false " +
           "AND e.retryCount > 0 AND e.retryCount < :maxRetries ORDER BY e.createdAt ASC")
    List<InboxEvent> findEventsNeedingRetry(@Param("maxRetries") int maxRetries,
                                            org.springframework.data.domain.Pageable pageable);
    
    /**
     * Find exhausted events (exceeded max retries).
     */
    @Query("SELECT e FROM InboxEvent e WHERE e.processed = false " +
           "AND e.retryCount >= :maxRetries ORDER BY e.createdAt ASC")
    List<InboxEvent> findExhaustedEvents(@Param("maxRetries") int maxRetries,
                                         org.springframework.data.domain.Pageable pageable);
    
    /**
     * Count unprocessed events.
     */
    long countByProcessedFalse();
    
    /**
     * Count unprocessed events by topic.
     */
    long countByProcessedFalseAndTopic(String topic);
    
    /**
     * Count failed events (exceeded retry limit).
     */
    @Query("SELECT COUNT(e) FROM InboxEvent e WHERE e.processed = false AND e.retryCount >= :maxRetries")
    long countExhaustedEvents(@Param("maxRetries") int maxRetries);
    
    /**
     * Delete old processed events for cleanup.
     * Returns number of deleted records.
     */
    @Modifying
    @Query("DELETE FROM InboxEvent e WHERE e.processed = true AND e.processedAt < :cutoffTime")
    int deleteProcessedEventsBefore(@Param("cutoffTime") LocalDateTime cutoffTime);
    
    /**
     * Mark an event as processed.
     */
    @Modifying
    @Query("UPDATE InboxEvent e SET e.processed = true, e.processedAt = :processedAt, " +
           "e.processorInstance = :processorInstance, e.lastError = null WHERE e.id = :id")
    int markAsProcessed(@Param("id") Long id, 
                        @Param("processedAt") LocalDateTime processedAt,
                        @Param("processorInstance") String processorInstance);
    
    /**
     * Increment retry count and set error for a failed event.
     */
    @Modifying
    @Query("UPDATE InboxEvent e SET e.retryCount = e.retryCount + 1, e.lastError = :error WHERE e.id = :id")
    int incrementRetryCount(@Param("id") Long id, @Param("error") String error);
    
    /**
     * Find events by topic for monitoring.
     */
    List<InboxEvent> findByTopicOrderByCreatedAtDesc(String topic, org.springframework.data.domain.Pageable pageable);
    
    /**
     * Get recent events for debugging/monitoring.
     */
    @Query("SELECT e FROM InboxEvent e ORDER BY e.createdAt DESC")
    List<InboxEvent> findRecentEvents(org.springframework.data.domain.Pageable pageable);
}
