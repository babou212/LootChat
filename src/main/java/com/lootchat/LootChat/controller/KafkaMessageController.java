package com.lootchat.LootChat.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lootchat.LootChat.dto.ChatMessageEvent;
import com.lootchat.LootChat.service.KafkaProducerService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/kafka")
public class KafkaMessageController {

    private static final Logger log = LoggerFactory.getLogger(KafkaMessageController.class);
    private final KafkaProducerService producerService;
    private final ObjectMapper objectMapper;
    @org.springframework.beans.factory.annotation.Value("${app.kafka.topics.chat:lootchat.chat.messages}")
    private String chatTopic;

    public KafkaMessageController(KafkaProducerService producerService, ObjectMapper objectMapper) {
        this.producerService = producerService;
        this.objectMapper = objectMapper;
    }

    @PostMapping("/publish")
    public ResponseEntity<?> publish(@RequestBody Map<String, String> payload) {
        String topic = payload.getOrDefault("topic", null);
        String key = payload.getOrDefault("key", null);
        String message = payload.get("message");

        if (message == null || message.isBlank()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "'message' is required"));
        }

        log.debug("Publishing to Kafka topic={} key={} message={} ", topic, key, message);
        producerService.send(topic, key, message);
        return ResponseEntity.accepted().body(Map.of("status", "queued"));
    }

    @PostMapping("/publish/chat")
    public ResponseEntity<?> publishChat(@RequestBody ChatMessageEvent event) {
        if (event.getContent() == null || event.getChannelId() == null || event.getUserId() == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "content, channelId, and userId are required"));
        }
        try {
            String payload = objectMapper.writeValueAsString(event);
            log.debug("Publishing ChatMessageEvent to Kafka topic={} payload={} ", chatTopic, payload);
            producerService.send(chatTopic, null, payload);
            return ResponseEntity.accepted().body(Map.of("status", "queued"));
        } catch (JsonProcessingException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to serialize payload"));
        }
    }
}
