package com.lootchat.LootChat.metrics;

import com.lootchat.LootChat.service.OutboxService;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Prometheus metrics for Outbox Pattern monitoring.
 * 
 * Metrics exposed:
 * - outbox_pending_events: Number of events waiting to be processed
 * - outbox_failed_events: Number of events that exceeded retry limit (DLQ)
 * 
 * These metrics can be used for:
 * - Alerting when pending events pile up (Kafka connectivity issue)
 * - Alerting when failed events exceed threshold (data issue)
 * - Dashboards showing message processing latency
 */
@Component
@RequiredArgsConstructor
public class OutboxMetrics {
    
    private final MeterRegistry meterRegistry;
    private final OutboxService outboxService;
    
    @PostConstruct
    public void registerMetrics() {
        // Gauge for pending events (real-time value)
        Gauge.builder("outbox_pending_events", outboxService, OutboxService::getPendingEventCount)
                .description("Number of outbox events pending processing")
                .tag("application", "lootchat")
                .register(meterRegistry);
        
        // Gauge for failed/DLQ events
        Gauge.builder("outbox_failed_events", outboxService, OutboxService::getFailedEventCount)
                .description("Number of outbox events in dead letter queue")
                .tag("application", "lootchat")
                .register(meterRegistry);
    }
}
