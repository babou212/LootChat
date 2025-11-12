package com.lootchat.LootChat.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.stereotype.Service;

import java.util.concurrent.CompletableFuture;

@Service
public class KafkaProducerService {

    private static final Logger log = LoggerFactory.getLogger(KafkaProducerService.class);

    private final KafkaTemplate<String, String> kafkaTemplate;

    @Value("${app.kafka.topics.chat:lootchat.chat.messages}")
    private String defaultTopic;

    public KafkaProducerService(KafkaTemplate<String, String> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    public CompletableFuture<Void> send(String topic, String key, String message) {
        String targetTopic = (topic == null || topic.isBlank()) ? defaultTopic : topic;
        log.debug("Producing message to topic='{}' key='{}' payload='{}'", targetTopic, key, message);
        
        return kafkaTemplate.send(targetTopic, key, message)
                .thenApply(SendResult::getRecordMetadata)
                .thenAccept(metadata -> {
                    if (log.isDebugEnabled()) {
                        log.debug("Successfully sent message to topic={} partition={} offset={} timestamp={}", 
                            metadata.topic(), 
                            metadata.partition(), 
                            metadata.offset(),
                            metadata.timestamp());
                    }
                })
                .exceptionally(ex -> {
                    log.error("Failed to send message to topic={} key={}", targetTopic, key, ex);
                    return null;
                });
    }
    
    public void sendSync(String topic, String key, String message) throws Exception {
        String targetTopic = (topic == null || topic.isBlank()) ? defaultTopic : topic;
        SendResult<String, String> result = kafkaTemplate.send(targetTopic, key, message).get();
        log.debug("Synchronously sent to {} partition {} offset {}", 
            result.getRecordMetadata().topic(),
            result.getRecordMetadata().partition(), 
            result.getRecordMetadata().offset());
    }
}
