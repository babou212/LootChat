package com.lootchat.LootChat.repository;

import com.lootchat.LootChat.entity.OutboxEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface OutboxEventRepository extends JpaRepository<OutboxEvent, Long> {
    
    /**
     * Find unprocessed events ordered by creation time
     */
    List<OutboxEvent> findByProcessedFalseOrderByCreatedAtAsc();
    
    /**
     * Find failed events that should be retried
     */
    @Query("SELECT e FROM OutboxEvent e WHERE e.processed = false AND e.retryCount < 5 AND e.createdAt < :before ORDER BY e.createdAt ASC")
    List<OutboxEvent> findRetryableEvents(LocalDateTime before);
    
    /**
     * Clean up old processed events (for maintenance)
     */
    void deleteByProcessedTrueAndProcessedAtBefore(LocalDateTime before);
}
