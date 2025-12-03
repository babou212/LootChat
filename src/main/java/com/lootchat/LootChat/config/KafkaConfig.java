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
import java.util.UUID;

@Configuration
@EnableConfigurationProperties(AppKafkaProperties.class)
@EnableKafka
public class KafkaConfig {

    private final AppKafkaProperties appKafkaProperties;
    private final KafkaProperties bootKafkaProperties;
    
    private final String instanceId = UUID.randomUUID().toString().substring(0, 8);

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

    @Bean
    public ProducerFactory<String, String> producerFactory() {
        Map<String, Object> configProps = new HashMap<>(bootKafkaProperties.buildProducerProperties(null));
        
        configProps.put(ProducerConfig.ACKS_CONFIG, "all");
        
        configProps.put(ProducerConfig.RETRIES_CONFIG, 3);
        configProps.put(ProducerConfig.RETRY_BACKOFF_MS_CONFIG, 1000);
        
        configProps.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true);
        
        configProps.put(ProducerConfig.COMPRESSION_TYPE_CONFIG, "lz4");
        
        configProps.put(ProducerConfig.LINGER_MS_CONFIG, 10);
        configProps.put(ProducerConfig.BATCH_SIZE_CONFIG, 16384);
        
        configProps.put(ProducerConfig.REQUEST_TIMEOUT_MS_CONFIG, 30000);
        configProps.put(ProducerConfig.DELIVERY_TIMEOUT_MS_CONFIG, 120000);
        
        DefaultKafkaProducerFactory<String, String> factory = new DefaultKafkaProducerFactory<>(configProps);
        
        String transactionIdPrefix = bootKafkaProperties.getProducer().getTransactionIdPrefix();
        if (transactionIdPrefix != null && !transactionIdPrefix.isEmpty()) {
            factory.setTransactionIdPrefix(transactionIdPrefix + "-" + instanceId + "-");
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
            System.err.println("Failed to process record after retries: " + consumerRecord + ", error: " + exception.getMessage());
        }, backOff);
        
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
                .partitions(3)
                .replicas(1)
                .config("compression.type", "lz4")
                .config("min.insync.replicas", "1")
                .build();
    }

    @Bean
    public NewTopic notificationsTopic() {
        return TopicBuilder.name(appKafkaProperties.getTopics().getNotifications())
                .partitions(3)
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

    /**
     * WebSocket broadcast topic for cross-pod synchronization.
     * Low retention since these are ephemeral real-time messages.
     */
    @Bean
    public NewTopic websocketBroadcastTopic() {
        return TopicBuilder.name("lootchat.websocket.broadcast")
                .partitions(3)
                .replicas(1)
                .config("compression.type", "lz4")
                .config("retention.ms", "60000")
                .config("segment.ms", "60000")
                .build();
    }
}
