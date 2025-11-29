package com.lootchat.LootChat.config;

import org.apache.kafka.clients.admin.AdminClientConfig;
import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.springframework.boot.autoconfigure.kafka.KafkaProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.annotation.EnableKafka;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.config.TopicBuilder;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.KafkaAdmin;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.core.ProducerFactory;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.kafka.support.ExponentialBackOffWithMaxRetries;

import java.util.HashMap;
import java.util.Map;

@Configuration
@EnableConfigurationProperties(AppKafkaProperties.class)
@EnableKafka
public class KafkaConfig {

    private final AppKafkaProperties appKafkaProperties;
    private final KafkaProperties bootKafkaProperties;

    public KafkaConfig(AppKafkaProperties appKafkaProperties,
                       KafkaProperties bootKafkaProperties) {
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
     * Enhanced producer factory with reliability settings and transaction support
     */
    @Bean
    public ProducerFactory<String, String> producerFactory() {
        Map<String, Object> configProps = new HashMap<>(bootKafkaProperties.buildProducerProperties(null));
        
        // Reliability: Wait for acknowledgment from all in-sync replicas
        configProps.put(ProducerConfig.ACKS_CONFIG, "all");
        
        // Retry configuration for transient failures
        configProps.put(ProducerConfig.RETRIES_CONFIG, 3);
        configProps.put(ProducerConfig.RETRY_BACKOFF_MS_CONFIG, 1000);
        
        // Idempotence: Prevent duplicate messages on retry
        configProps.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true);
        
        // Compression for performance
        configProps.put(ProducerConfig.COMPRESSION_TYPE_CONFIG, "lz4");
        
        // Batching for throughput
        configProps.put(ProducerConfig.LINGER_MS_CONFIG, 10);
        configProps.put(ProducerConfig.BATCH_SIZE_CONFIG, 16384);
        
        // Timeout configuration
        configProps.put(ProducerConfig.REQUEST_TIMEOUT_MS_CONFIG, 30000);
        configProps.put(ProducerConfig.DELIVERY_TIMEOUT_MS_CONFIG, 120000);
        
        DefaultKafkaProducerFactory<String, String> factory = new DefaultKafkaProducerFactory<>(configProps);
        
        // Enable transactions if transaction-id-prefix is configured
        String transactionIdPrefix = bootKafkaProperties.getProducer().getTransactionIdPrefix();
        if (transactionIdPrefix != null && !transactionIdPrefix.isEmpty()) {
            factory.setTransactionIdPrefix(transactionIdPrefix);
        }
        
        return factory;
    }

    @Bean
    public KafkaTemplate<String, String> kafkaTemplate(ProducerFactory<String, String> producerFactory) {
        return new KafkaTemplate<>(producerFactory);
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
