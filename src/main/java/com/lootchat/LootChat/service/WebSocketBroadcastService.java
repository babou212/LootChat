package com.lootchat.LootChat.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.UUID;


@Service
@RequiredArgsConstructor
@Slf4j
public class WebSocketBroadcastService {
    
    public static final String TOPIC = "lootchat.websocket.broadcast";
    
    private final KafkaTemplate<String, String> kafkaTemplate;
    private final SimpMessagingTemplate messagingTemplate;
    private final ObjectMapper objectMapper;
    
    // Instance identifier - used for consumer group to ensure all pods receive all messages
    private final String instanceId = UUID.randomUUID().toString().substring(0, 8);
    
    /**
     * Broadcast a message to all pods via Kafka.
     * Each pod will receive the message and broadcast locally to WebSocket clients.
     * 
     * @param destination The WebSocket destination (e.g., "/topic/messages")
     * @param payload The message payload to send
     */
    public void broadcast(String destination, Object payload) {
        try {
            BroadcastMessage message = new BroadcastMessage(
                    instanceId,
                    destination,
                    objectMapper.writeValueAsString(payload)
            );
            
            String json = objectMapper.writeValueAsString(message);
            kafkaTemplate.send(TOPIC, destination, json);
            
            log.debug("Published WebSocket broadcast to Kafka: destination={}", destination);
            
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize broadcast message: destination={}", destination, e);
            // Fallback to local-only broadcast
            messagingTemplate.convertAndSend(destination, payload);
        }
    }
    
    /**
     * Broadcast to a user-specific destination.
     * 
     * @param userId The user ID
     * @param destination The destination suffix (e.g., "/direct-messages")
     * @param payload The message payload
     */
    public void broadcastToUser(Long userId, String destination, Object payload) {
        broadcast("/topic/user/" + userId + destination, payload);
    }
    
    /**
     * Broadcast to a channel-specific destination.
     * 
     * @param channelId The channel ID
     * @param destination The destination suffix (e.g., "/messages")
     * @param payload The message payload
     */
    public void broadcastToChannel(Long channelId, String destination, Object payload) {
        broadcast("/topic/channels/" + channelId + destination, payload);
    }
    
    /**
     * Consume WebSocket broadcast messages from Kafka.
     * 
     * IMPORTANT: Uses a random consumer group ID so each pod instance
     * receives ALL messages (fan-out pattern), not load-balanced.
     * This is achieved via SpEL expression that generates unique group per instance.
     */
    @KafkaListener(
            topics = TOPIC,
            groupId = "websocket-broadcast-#{T(java.util.UUID).randomUUID().toString()}",
            concurrency = "1"
    )
    public void handleBroadcast(ConsumerRecord<String, String> record) {
        try {
            BroadcastMessage message = objectMapper.readValue(record.value(), BroadcastMessage.class);
            
            Object payload = objectMapper.readValue(message.payload(), Object.class);
            
            messagingTemplate.convertAndSend(message.destination(), payload);
            
            log.debug("Received from Kafka and broadcasted locally: destination={}, origin={}", 
                    message.destination(), message.instanceId());
            
        } catch (JsonProcessingException e) {
            log.error("Failed to deserialize broadcast message: {}", record.value(), e);
        }
    }
    
    /**
     * Get the Kafka topic name for WebSocket broadcasts.
     */
    public static String getTopic() {
        return TOPIC;
    }
    
    /**
     * Internal record for Kafka broadcast messages.
     */
    public record BroadcastMessage(
            String instanceId,
            String destination,
            String payload
    ) {}
}
