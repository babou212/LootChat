package com.lootchat.LootChat.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.fasterxml.jackson.datatype.jsr310.ser.LocalDateTimeSerializer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

/**
 * Jackson configuration for consistent JSON serialization.
 * 
 * Key features:
 * - Serializes LocalDateTime with 'Z' suffix to indicate UTC
 * - This ensures clients in different timezones parse dates correctly
 * - Uses ISO-8601 format for maximum compatibility
 */
@Configuration
public class JacksonConfig {
    
    /**
     * Custom serializer that appends 'Z' to LocalDateTime to indicate UTC.
     * This fixes timezone issues where LocalDateTime was serialized without timezone info,
     * causing JavaScript to interpret it as local time instead of UTC.
     */
    private static final DateTimeFormatter UTC_FORMATTER = 
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss'Z'");
    
    @Bean
    @Primary
    public ObjectMapper objectMapper() {
        ObjectMapper mapper = new ObjectMapper();
        
        // Register Java 8 time module with custom LocalDateTime serializer
        JavaTimeModule javaTimeModule = new JavaTimeModule();
        javaTimeModule.addSerializer(LocalDateTime.class, 
                new LocalDateTimeSerializer(UTC_FORMATTER));
        
        mapper.registerModule(javaTimeModule);
        
        // Write dates as ISO strings, not timestamps
        mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        
        return mapper;
    }
}
