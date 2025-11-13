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

    Map<String, RedisCacheConfiguration> initialCaches = Map.of(
        "user", cacheConfig.entryTtl(Duration.ofMinutes(3)),
        "messagesAll", cacheConfig.entryTtl(Duration.ofSeconds(30)),
        "channelMessages", cacheConfig.entryTtl(Duration.ofSeconds(30)),
        "message", cacheConfig.entryTtl(Duration.ofMinutes(5))
    );

    return RedisCacheManager.builder(connectionFactory)
        .cacheDefaults(cacheConfig)
        .withInitialCacheConfigurations(initialCaches)
        .transactionAware()
        .build();
    }
}
