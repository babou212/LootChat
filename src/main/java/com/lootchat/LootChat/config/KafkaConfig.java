package com.lootchat.LootChat.config;

import org.apache.kafka.clients.admin.AdminClientConfig;
import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.annotation.EnableKafka;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.config.TopicBuilder;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.core.KafkaAdmin;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.kafka.support.ExponentialBackOffWithMaxRetries;

import java.util.HashMap;
import java.util.Map;

@Configuration
@EnableConfigurationProperties(AppKafkaProperties.class)
@EnableKafka
public class KafkaConfig {

    private final AppKafkaProperties appKafkaProperties;
    private final org.springframework.boot.autoconfigure.kafka.KafkaProperties bootKafkaProperties;

    public KafkaConfig(AppKafkaProperties appKafkaProperties,
                       org.springframework.boot.autoconfigure.kafka.KafkaProperties bootKafkaProperties) {
        this.appKafkaProperties = appKafkaProperties;
        this.bootKafkaProperties = bootKafkaProperties;
    }

    @Bean
    public KafkaAdmin kafkaAdmin() {
        Map<String, Object> configs = new HashMap<>();
        configs.put(AdminClientConfig.BOOTSTRAP_SERVERS_CONFIG, String.join(",", bootKafkaProperties.getBootstrapServers()));
        return new KafkaAdmin(configs);
    }

    /**
     * Error handler with exponential backoff for resilient message processing
     */
    @Bean
    public DefaultErrorHandler errorHandler() {
        // Exponential backoff: initial 1s, multiplier 2x, max 3 attempts
        ExponentialBackOffWithMaxRetries backOff = new ExponentialBackOffWithMaxRetries(3);
        backOff.setInitialInterval(1000L);
        backOff.setMultiplier(2.0);
        backOff.setMaxInterval(10000L);
        
        DefaultErrorHandler errorHandler = new DefaultErrorHandler((consumerRecord, exception) -> {
            // This is called after all retries are exhausted
            // Log the failed record for manual investigation or send to DLQ
            System.err.println("Failed to process record after retries: " + consumerRecord + ", error: " + exception.getMessage());
        }, backOff);
        
        // Don't retry for certain exceptions (like deserialization errors)
        errorHandler.addNotRetryableExceptions(
            org.springframework.kafka.support.serializer.DeserializationException.class,
            com.fasterxml.jackson.core.JsonProcessingException.class
        );
        
        return errorHandler;
    }

    /**
     * Custom listener container factory with error handling
     */
    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, String> kafkaListenerContainerFactory(
            ConsumerFactory<String, String> consumerFactory,
            DefaultErrorHandler errorHandler) {
        ConcurrentKafkaListenerContainerFactory<String, String> factory = 
            new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(consumerFactory);
        factory.setCommonErrorHandler(errorHandler);
        return factory;
    }

    @Bean
    public NewTopic chatTopic() {
        return TopicBuilder.name(appKafkaProperties.getTopics().getChat())
                .partitions(3)  // Increased for parallel processing
                .replicas(1)
                .config("compression.type", "lz4")  // Enable compression
                .config("min.insync.replicas", "1")
                .build();
    }

    @Bean
    public NewTopic notificationsTopic() {
        return TopicBuilder.name(appKafkaProperties.getTopics().getNotifications())
                .partitions(3)  // Increased for parallel processing
                .replicas(1)
                .config("compression.type", "lz4")
                .config("min.insync.replicas", "1")
                .build();
    }

    /**
     * Dead Letter Queue topic for failed messages
     */
    @Bean
    public NewTopic deadLetterTopic() {
        return TopicBuilder.name("lootchat.dlq")
                .partitions(1)
                .replicas(1)
                .build();
    }
}
