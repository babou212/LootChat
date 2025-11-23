package com.lootchat.LootChat.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;
import java.util.Map;

import java.time.Duration;

@Configuration
@EnableCaching
public class RedisConfig {

    @Bean
    public RedisCacheManager cacheManager(RedisConnectionFactory connectionFactory, ObjectMapper objectMapper) {
        ObjectMapper redisObjectMapper = objectMapper.copy().findAndRegisterModules();

        GenericJackson2JsonRedisSerializer valueSerializer = new GenericJackson2JsonRedisSerializer(redisObjectMapper);

        RedisCacheConfiguration cacheConfig = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofMinutes(10)) 
                .serializeKeysWith(RedisSerializationContext.SerializationPair.fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(RedisSerializationContext.SerializationPair.fromSerializer(valueSerializer))
                .disableCachingNullValues();

        // Optimized TTL values based on data change frequency
        Map<String, RedisCacheConfiguration> initialCaches = Map.of(
            // User caches - moderate TTL with event-driven invalidation
            "users", cacheConfig.entryTtl(Duration.ofMinutes(15)),
            "user", cacheConfig.entryTtl(Duration.ofMinutes(15)),
            
            // Channel caches - long TTL (rarely change)
            "channels", cacheConfig.entryTtl(Duration.ofHours(1)),
            "channel", cacheConfig.entryTtl(Duration.ofHours(1)),
            
            // Message caches - shorter TTL with real-time invalidation
            "channelMessages", cacheConfig.entryTtl(Duration.ofMinutes(5)),
            "channelMessagesPaginated", cacheConfig.entryTtl(Duration.ofMinutes(5)),
            "message", cacheConfig.entryTtl(Duration.ofMinutes(10)),
            
            // Presence cache - very short TTL for real-time updates
            "userPresence", cacheConfig.entryTtl(Duration.ofMinutes(2)),
            "allPresence", cacheConfig.entryTtl(Duration.ofMinutes(1))
        );

        return RedisCacheManager.builder(connectionFactory)
            .cacheDefaults(cacheConfig)
            .withInitialCacheConfigurations(initialCaches)
            .transactionAware()
            .build();
    }
}
