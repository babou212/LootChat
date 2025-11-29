package com.lootchat.LootChat.service;

import com.lootchat.LootChat.entity.User;
import com.lootchat.LootChat.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.util.*;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("UserPresenceService Tests")
class UserPresenceServiceTest {

    @Mock
    private OutboxService outboxService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private RedisTemplate<String, String> redisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    private UserPresenceService userPresenceService;

    private User user1;
    private User user2;
    private User user3;

    @BeforeEach
    void setUp() {
        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        userPresenceService = new UserPresenceService(userRepository, outboxService, redisTemplate);
        
        user1 = User.builder()
                .id(1L)
                .username("user1")
                .email("user1@example.com")
                .avatar("avatar1.jpg")
                .build();

        user2 = User.builder()
                .id(2L)
                .username("user2")
                .email("user2@example.com")
                .avatar(null)
                .build();

        user3 = User.builder()
                .id(3L)
                .username("user3")
                .email("user3@example.com")
                .avatar("avatar3.jpg")
                .build();
    }

    @Test
    @DisplayName("userConnected should mark user as online and save to outbox")
    void userConnected_ShouldMarkUserOnline_AndSaveToOutbox() {
        String username = "user1";
        Long userId = 1L;

        userPresenceService.userConnected(username, userId);

        verify(valueOperations).set(eq("user:presence:user1"), eq("online"), eq(5L), eq(TimeUnit.MINUTES));
        verify(outboxService).saveEvent(
                eq(OutboxService.EVENT_PRESENCE_UPDATED),
                eq(OutboxService.TOPIC_PRESENCE),
                eq("1"),
                any()
        );
    }

    @Test
    @DisplayName("userDisconnected should remove from Redis and save to outbox")
    void userDisconnected_ShouldRemoveFromRedis_AndSaveToOutbox() {
        String username = "user1";
        Long userId = 1L;

        userPresenceService.userDisconnected(username, userId);

        verify(redisTemplate).delete("user:presence:user1");
        verify(outboxService).saveEvent(
                eq(OutboxService.EVENT_PRESENCE_UPDATED),
                eq(OutboxService.TOPIC_PRESENCE),
                eq("1"),
                any()
        );
    }

    @Test
    @DisplayName("isUserOnline should return true when Redis has online status")
    void isUserOnline_ShouldReturnTrue_WhenRedisHasOnlineStatus() {
        when(valueOperations.get("user:presence:user1")).thenReturn("online");

        boolean isOnline = userPresenceService.isUserOnline("user1");

        assertThat(isOnline).isTrue();
    }

    @Test
    @DisplayName("isUserOnline should return false when Redis has no status")
    void isUserOnline_ShouldReturnFalse_WhenRedisHasNoStatus() {
        when(valueOperations.get("user:presence:nonexistent")).thenReturn(null);

        boolean isOnline = userPresenceService.isUserOnline("nonexistent");

        assertThat(isOnline).isFalse();
    }

    @Test
    @DisplayName("getOnlineUsers should return usernames from Redis keys")
    void getOnlineUsers_ShouldReturnUsernames_FromRedisKeys() {
        Set<String> keys = Set.of("user:presence:user1", "user:presence:user3");
        when(redisTemplate.keys("user:presence:*")).thenReturn(keys);

        Set<String> onlineUsers = userPresenceService.getOnlineUsers();

        assertThat(onlineUsers).containsExactlyInAnyOrder("user1", "user3");
    }

    @Test
    @DisplayName("getOnlineUsers should return empty set when no keys in Redis")
    void getOnlineUsers_ShouldReturnEmptySet_WhenNoKeysInRedis() {
        when(redisTemplate.keys("user:presence:*")).thenReturn(null);

        Set<String> onlineUsers = userPresenceService.getOnlineUsers();

        assertThat(onlineUsers).isEmpty();
    }

    @Test
    @DisplayName("getAllUserPresence should return presence map from Redis")
    void getAllUserPresence_ShouldReturnPresenceMap_FromRedis() {
        Set<String> keys = Set.of("user:presence:user1", "user:presence:user3");
        when(redisTemplate.keys("user:presence:*")).thenReturn(keys);
        when(userRepository.findByUsername("user1")).thenReturn(user1);
        when(userRepository.findByUsername("user3")).thenReturn(user3);
        when(valueOperations.get("user:presence:user1")).thenReturn("online");
        when(valueOperations.get("user:presence:user3")).thenReturn("online");

        Map<Long, Boolean> presenceMap = userPresenceService.getAllUserPresence();

        assertThat(presenceMap.get(1L)).isTrue();
        assertThat(presenceMap.get(3L)).isTrue();
    }

    @Test
    @DisplayName("getAllUserPresence should skip users not found in repository")
    void getAllUserPresence_ShouldSkipUsersNotFound() {
        Set<String> keys = Set.of("user:presence:user1", "user:presence:ghost");
        when(redisTemplate.keys("user:presence:*")).thenReturn(keys);
        when(userRepository.findByUsername("user1")).thenReturn(user1);
        when(userRepository.findByUsername("ghost")).thenReturn(null);
        when(valueOperations.get("user:presence:user1")).thenReturn("online");

        Map<Long, Boolean> presenceMap = userPresenceService.getAllUserPresence();

        assertThat(presenceMap).containsKey(1L);
        assertThat(presenceMap).hasSize(1);
    }
}
