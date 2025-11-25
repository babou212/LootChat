package com.lootchat.LootChat.metrics;

import com.lootchat.LootChat.repository.OutboxEventRepository;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Metrics for Outbox Event Processing
 * Monitors event queue health and delivery performance
 */
@Component
@Slf4j
public class OutboxEventMetrics {
    
    private final OutboxEventRepository outboxRepository;
    
    private final AtomicLong pendingEventsCount = new AtomicLong(0);
    private final AtomicLong failedEventsCount = new AtomicLong(0);
    private final AtomicLong oldestPendingAgeSeconds = new AtomicLong(0);
    
    public OutboxEventMetrics(OutboxEventRepository outboxRepository, MeterRegistry meterRegistry) {
        this.outboxRepository = outboxRepository;
        
        // Register gauges
        Gauge.builder("outbox.events.pending", pendingEventsCount, AtomicLong::get)
            .description("Number of pending outbox events")
            .tag("status", "pending")
            .register(meterRegistry);
        
        Gauge.builder("outbox.events.failed", failedEventsCount, AtomicLong::get)
            .description("Number of failed outbox events (retry count >= 5)")
            .tag("status", "failed")
            .register(meterRegistry);
        
        Gauge.builder("outbox.events.oldest.age.seconds", oldestPendingAgeSeconds, AtomicLong::get)
            .description("Age of oldest pending event in seconds")
            .register(meterRegistry);
    }
    
    /**
     * Update metrics every 10 seconds
     */
    @Scheduled(fixedDelay = 10000)
    public void updateMetrics() {
        try {
            long pending = outboxRepository.findByProcessedFalseOrderByCreatedAtAsc().size();
            pendingEventsCount.set(pending);
            
            long failed = outboxRepository.findRetryableEvents(LocalDateTime.now()).stream()
                .filter(e -> e.getRetryCount() >= 5)
                .count();
            failedEventsCount.set(failed);
            
            outboxRepository.findByProcessedFalseOrderByCreatedAtAsc().stream()
                .findFirst()
                .ifPresentOrElse(
                    oldest -> {
                        long ageSeconds = java.time.Duration.between(oldest.getCreatedAt(), LocalDateTime.now()).getSeconds();
                        oldestPendingAgeSeconds.set(ageSeconds);
                    },
                    () -> oldestPendingAgeSeconds.set(0)
                );
            
            if (pending > 100) {
                log.warn("Outbox queue backlog: {} pending events", pending);
            }
            
            if (failed > 0) {
                log.error("Outbox has {} permanently failed events", failed);
            }
            
        } catch (Exception e) {
            log.error("Failed to update outbox metrics", e);
        }
    }
}
