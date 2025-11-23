package com.lootchat.LootChat.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

@DisplayName("RedisConfig Tests")
class RedisConfigTest {

    @Test
    @DisplayName("cacheManager should be created successfully with valid configuration")
    void cacheManager_ShouldBeCreated_WithValidConfiguration() {
        RedisConfig redisConfig = new RedisConfig();
        RedisConnectionFactory connectionFactory = mock(RedisConnectionFactory.class);
        ObjectMapper objectMapper = new ObjectMapper();

        RedisCacheManager cacheManager = redisConfig.cacheManager(connectionFactory, objectMapper);

        assertThat(cacheManager).isNotNull();
    }

    @Test
    @DisplayName("cacheManager should accept ObjectMapper configuration")
    void cacheManager_ShouldAccept_ObjectMapperConfiguration() {
        RedisConfig redisConfig = new RedisConfig();
        RedisConnectionFactory connectionFactory = mock(RedisConnectionFactory.class);
        ObjectMapper customObjectMapper = new ObjectMapper();

        RedisCacheManager cacheManager = redisConfig.cacheManager(connectionFactory, customObjectMapper);

        assertThat(cacheManager).isNotNull();
    }
}
