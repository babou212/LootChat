package com.lootchat.LootChat.config;

import com.lootchat.LootChat.dto.ChannelResponse;
import com.lootchat.LootChat.service.ChannelService;
import com.lootchat.LootChat.service.MessageService;
import com.lootchat.LootChat.service.UserService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Cache warming component that preloads frequently accessed data on application startup.
 * This reduces cold start latency by ensuring commonly used data is already cached.
 */
@Component
@RequiredArgsConstructor
public class CacheWarmer {

    private static final Logger log = LoggerFactory.getLogger(CacheWarmer.class);

    private final UserService userService;
    private final ChannelService channelService;
    private final MessageService messageService;

    /**
     * Warms up Redis cache after application has fully started.
     * Runs asynchronously to avoid blocking application startup.
     */
    @Async
    @EventListener(ApplicationReadyEvent.class)
    public void warmCache() {
        log.info("Starting cache warming...");
        long startTime = System.currentTimeMillis();

        try {
            log.debug("Warming user cache...");
            userService.getAllUsers();
            
            log.debug("Warming channel cache...");
            channelService.getAllChannels();
            
            log.debug("Warming message cache for active channels...");
            List<ChannelResponse> channels = channelService.getAllChannels();
            channels.stream()
                    .limit(5)
                    .forEach(channel -> {
                        try {
                            messageService.getMessagesByChannelIdPaginated(channel.getId(), 0, 50);
                        } catch (Exception e) {
                            log.warn("Failed to warm message cache for channel {}: {}", 
                                    channel.getId(), e.getMessage());
                        }
                    });

            long duration = System.currentTimeMillis() - startTime;
            log.info("Cache warming completed successfully in {}ms", duration);
            
        } catch (Exception e) {
            log.error("Cache warming failed", e);
        }
    }
}
