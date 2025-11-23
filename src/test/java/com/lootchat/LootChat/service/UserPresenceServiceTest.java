package com.lootchat.LootChat.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lootchat.LootChat.entity.User;
import com.lootchat.LootChat.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.*;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("UserPresenceService Tests")
class UserPresenceServiceTest {

    @Mock
    private KafkaProducerService kafkaProducerService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ObjectMapper objectMapper;

    @InjectMocks
    private UserPresenceService userPresenceService;

    private User user1;
    private User user2;
    private User user3;

    @BeforeEach
    void setUp() {
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
    @DisplayName("userConnected should mark user as online and broadcast event")
    void userConnected_ShouldMarkUserOnline_AndBroadcastEvent() throws Exception {
        String username = "user1";
        Long userId = 1L;
        when(objectMapper.writeValueAsString(any())).thenReturn("{\"userId\":1,\"username\":\"user1\",\"status\":\"online\"}");
        when(kafkaProducerService.send(any(), any(), anyString())).thenReturn(java.util.concurrent.CompletableFuture.completedFuture(null));

        userPresenceService.userConnected(username, userId);

        assertThat(userPresenceService.isUserOnline(username)).isTrue();
        verify(kafkaProducerService, times(1)).send(null, null, "{\"userId\":1,\"username\":\"user1\",\"status\":\"online\"}");
    }

    @Test
    @DisplayName("userDisconnected should mark user as offline and broadcast event")
    void userDisconnected_ShouldMarkUserOffline_AndBroadcastEvent() throws Exception {
        String username = "user1";
        Long userId = 1L;
        when(objectMapper.writeValueAsString(any())).thenReturn("{}");
        when(kafkaProducerService.send(any(), any(), anyString())).thenReturn(java.util.concurrent.CompletableFuture.completedFuture(null));
        userPresenceService.userConnected(username, userId);
        
        when(objectMapper.writeValueAsString(any())).thenReturn("{\"userId\":1,\"username\":\"user1\",\"status\":\"offline\"}");

        userPresenceService.userDisconnected(username, userId);

        assertThat(userPresenceService.isUserOnline(username)).isFalse();
        verify(kafkaProducerService, times(1)).send(null, null, "{\"userId\":1,\"username\":\"user1\",\"status\":\"offline\"}");
    }

    @Test
    @DisplayName("isUserOnline should return false for user that never connected")
    void isUserOnline_ShouldReturnFalse_ForNeverConnectedUser() {
        boolean isOnline = userPresenceService.isUserOnline("nonexistent");

        assertThat(isOnline).isFalse();
    }

    @Test
    @DisplayName("isUserOnline should return true for connected user")
    void isUserOnline_ShouldReturnTrue_ForConnectedUser() {
        String username = "user1";
        Long userId = 1L;
        userPresenceService.userConnected(username, userId);

        boolean isOnline = userPresenceService.isUserOnline(username);

        assertThat(isOnline).isTrue();
    }

    @Test
    @DisplayName("getOnlineUsers should return only online usernames")
    void getOnlineUsers_ShouldReturnOnlyOnlineUsernames() {
        userPresenceService.userConnected("user1", 1L);
        userPresenceService.userConnected("user2", 2L);
        userPresenceService.userConnected("user3", 3L);
        userPresenceService.userDisconnected("user2", 2L);

        Set<String> onlineUsers = userPresenceService.getOnlineUsers();

        assertThat(onlineUsers).containsExactlyInAnyOrder("user1", "user3");
        assertThat(onlineUsers).doesNotContain("user2");
    }

    @Test
    @DisplayName("getOnlineUsers should return empty set when no users online")
    void getOnlineUsers_ShouldReturnEmptySet_WhenNoUsersOnline() {
        Set<String> onlineUsers = userPresenceService.getOnlineUsers();

        assertThat(onlineUsers).isEmpty();
    }

    @Test
    @DisplayName("getAllUserPresence should return presence map for all users")
    void getAllUserPresence_ShouldReturnPresenceMap_ForAllUsers() {
        when(userRepository.findByUsername("user1")).thenReturn(user1);
        when(userRepository.findByUsername("user2")).thenReturn(user2);
        when(userRepository.findByUsername("user3")).thenReturn(user3);
        
        userPresenceService.userConnected("user1", 1L);
        userPresenceService.userConnected("user3", 3L);
        userPresenceService.userDisconnected("user2", 2L);

        Map<Long, Boolean> presenceMap = userPresenceService.getAllUserPresence();

        assertThat(presenceMap.get(1L)).isTrue();
        assertThat(presenceMap.get(2L)).isFalse();
        assertThat(presenceMap.get(3L)).isTrue();
    }

    @Test
    @DisplayName("getAllUserPresence should handle users not found in repository")
    void getAllUserPresence_ShouldHandleUsersNotFound() {
        when(userRepository.findByUsername("user1")).thenReturn(user1);
        when(userRepository.findByUsername("ghost")).thenReturn(null);
        
        userPresenceService.userConnected("user1", 1L);
        userPresenceService.userConnected("ghost", 999L);

        Map<Long, Boolean> presenceMap = userPresenceService.getAllUserPresence();

        assertThat(presenceMap).containsKey(1L);
        assertThat(presenceMap).doesNotContainKey(999L);
        assertThat(presenceMap.get(1L)).isTrue();
    }

    @Test
    @DisplayName("concurrent operations should be thread-safe")
    void concurrentOperations_ShouldBeThreadSafe() throws Exception {
        int threadCount = 10;
        int operationsPerThread = 100;
        ExecutorService executorService = Executors.newFixedThreadPool(threadCount);
        CountDownLatch latch = new CountDownLatch(threadCount);
        when(objectMapper.writeValueAsString(any())).thenReturn("{}");

        for (int i = 0; i < threadCount; i++) {
            final String username = "user" + i;
            final Long userId = (long) i;
            executorService.submit(() -> {
                try {
                    for (int j = 0; j < operationsPerThread; j++) {
                        userPresenceService.userConnected(username, userId);
                        userPresenceService.isUserOnline(username);
                        userPresenceService.getOnlineUsers();
                        if (j % 2 == 0) {
                            userPresenceService.userDisconnected(username, userId);
                        }
                    }
                } finally {
                    latch.countDown();
                }
            });
        }

        latch.await(10, TimeUnit.SECONDS);
        executorService.shutdown();

        assertThat(executorService.awaitTermination(5, TimeUnit.SECONDS)).isTrue();
        
        Set<String> onlineUsers = userPresenceService.getOnlineUsers();
        for (String username : onlineUsers) {
            assertThat(userPresenceService.isUserOnline(username)).isTrue();
        }
    }

    @Test
    @DisplayName("userConnected should handle multiple connections for same user")
    void userConnected_ShouldHandleMultipleConnections_ForSameUser() throws Exception {
        String username = "user1";
        Long userId = 1L;
        when(objectMapper.writeValueAsString(any())).thenReturn("{}");
        when(kafkaProducerService.send(any(), any(), anyString())).thenReturn(java.util.concurrent.CompletableFuture.completedFuture(null));

        userPresenceService.userConnected(username, userId);
        userPresenceService.userConnected(username, userId);
        userPresenceService.userConnected(username, userId);

        assertThat(userPresenceService.isUserOnline(username)).isTrue();
        Set<String> onlineUsers = userPresenceService.getOnlineUsers();
        assertThat(onlineUsers).containsExactly(username);
    }

    @Test
    @DisplayName("userDisconnected should handle disconnecting already offline user")
    void userDisconnected_ShouldHandleDisconnecting_AlreadyOfflineUser() throws Exception {
        String username = "user1";
        Long userId = 1L;
        when(objectMapper.writeValueAsString(any())).thenReturn("{}");
        when(kafkaProducerService.send(any(), any(), anyString())).thenReturn(java.util.concurrent.CompletableFuture.completedFuture(null));

        userPresenceService.userDisconnected(username, userId);

        assertThat(userPresenceService.isUserOnline(username)).isFalse();
        verify(kafkaProducerService, times(1)).send(null, null, "{}");
    }

    @Test
    @DisplayName("broadcastPresenceUpdate should handle JSON serialization errors")
    void broadcastPresenceUpdate_ShouldHandleJsonErrors() throws Exception {
        String username = "user1";
        Long userId = 1L;
        when(objectMapper.writeValueAsString(any())).thenThrow(new RuntimeException("JSON error"));

        userPresenceService.userConnected(username, userId);

        assertThat(userPresenceService.isUserOnline(username)).isTrue();
        verify(kafkaProducerService, never()).send(any(), any(), anyString());
    }
}
