package com.lootchat.LootChat.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.context.annotation.Bean;
import java.util.concurrent.Executor;

/**
 * Configuration for asynchronous task execution.
 * Enables @Async annotation support for non-blocking operations.
 */
@Configuration
@EnableAsync
public class AsyncConfig {

    /**
     * Task executor for async operations like cache warming.
     * Uses a small thread pool since these are lightweight background tasks.
     */
    @Bean(name = "taskExecutor")
    public Executor taskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(4);
        executor.setQueueCapacity(10);
        executor.setThreadNamePrefix("async-");
        executor.initialize();
        return executor;
    }
}
