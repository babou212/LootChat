package com.lootchat.LootChat.config;

import com.lootchat.LootChat.service.message.MessageSearchService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class ElasticsearchIndexInitializer {

    private final MessageSearchService messageSearchService;

    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        try {
            log.info("Starting Elasticsearch message reindex...");
            messageSearchService.reindexAllMessages();
            log.info("Elasticsearch message reindex completed successfully");
        } catch (Exception e) {
            log.error("Failed to reindex messages on startup", e);
            // Don't fail application startup if indexing fails
        }
    }
}
