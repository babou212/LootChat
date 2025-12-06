package com.lootchat.LootChat.service;

import com.lootchat.LootChat.dto.channel.UnreadCountResponse;
import com.lootchat.LootChat.entity.*;
import com.lootchat.LootChat.repository.*;
import com.lootchat.LootChat.security.CurrentUserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ChannelReadStateServiceTest {

    @Mock
    private UserChannelReadStateRepository readStateRepository;

    @Mock
    private ChannelRepository channelRepository;

    @Mock
    private MessageRepository messageRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private CurrentUserService currentUserService;

    @InjectMocks
    private ChannelReadStateService channelReadStateService;

    private User testUser;
    private Channel testChannel;
    private UserChannelReadState testReadState;

    @BeforeEach
    void setUp() {
        testUser = User.builder()
                .id(1L)
                .username("testuser")
                .email("test@example.com")
                .password("password")
                .build();

        testChannel = Channel.builder()
                .id(1L)
                .name("general")
                .description("General chat")
                .channelType(ChannelType.TEXT)
                .build();

        testReadState = UserChannelReadState.builder()
                .id(1L)
                .user(testUser)
                .channel(testChannel)
                .lastReadAt(LocalDateTime.now().minusHours(1))
                .lastReadMessageId(100L)
                .build();
    }

    @Test
    @DisplayName("markChannelAsRead should update existing read state")
    void markChannelAsRead_ExistingState_ShouldUpdate() {
        // Given
        when(currentUserService.getCurrentUserIdOrThrow()).thenReturn(1L);
        when(channelRepository.findById(1L)).thenReturn(Optional.of(testChannel));
        when(messageRepository.findLatestMessageIdInChannel(1L)).thenReturn(Optional.of(150L));
        when(readStateRepository.findByUserIdAndChannelId(1L, 1L)).thenReturn(Optional.of(testReadState));
        when(readStateRepository.save(any(UserChannelReadState.class))).thenReturn(testReadState);

        // When
        channelReadStateService.markChannelAsRead(1L);

        // Then
        verify(readStateRepository).save(argThat(state -> 
            state.getLastReadMessageId().equals(150L) &&
            state.getLastReadAt() != null
        ));
    }

    @Test
    @DisplayName("markChannelAsRead should create new read state when none exists")
    void markChannelAsRead_NoExistingState_ShouldCreate() {
        // Given
        when(currentUserService.getCurrentUserIdOrThrow()).thenReturn(1L);
        when(channelRepository.findById(1L)).thenReturn(Optional.of(testChannel));
        when(messageRepository.findLatestMessageIdInChannel(1L)).thenReturn(Optional.of(150L));
        when(readStateRepository.findByUserIdAndChannelId(1L, 1L)).thenReturn(Optional.empty());
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(readStateRepository.save(any(UserChannelReadState.class))).thenAnswer(i -> i.getArgument(0));

        // When
        channelReadStateService.markChannelAsRead(1L);

        // Then
        verify(readStateRepository).save(argThat(state ->
            state.getUser().getId().equals(1L) &&
            state.getChannel().getId().equals(1L) &&
            state.getLastReadMessageId().equals(150L)
        ));
    }

    @Test
    @DisplayName("markChannelAsRead should throw when channel not found")
    void markChannelAsRead_ChannelNotFound_ShouldThrow() {
        // Given
        when(currentUserService.getCurrentUserIdOrThrow()).thenReturn(1L);
        when(channelRepository.findById(999L)).thenReturn(Optional.empty());

        // When/Then
        assertThatThrownBy(() -> channelReadStateService.markChannelAsRead(999L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Channel not found");
    }

    @Test
    @DisplayName("getUnreadCountsForUser should return correct counts for multiple channels")
    void getUnreadCountsForUser_MultipleChannels_ShouldReturnCorrectCounts() {
        // Given
        Channel channel2 = Channel.builder()
                .id(2L)
                .name("random")
                .channelType(ChannelType.TEXT)
                .build();

        List<Channel> channels = Arrays.asList(testChannel, channel2);
        
        UserChannelReadState readState2 = UserChannelReadState.builder()
                .id(2L)
                .user(testUser)
                .channel(channel2)
                .lastReadAt(LocalDateTime.now().minusHours(2))
                .build();

        when(channelRepository.findAll()).thenReturn(channels);
        when(readStateRepository.findByUserId(1L)).thenReturn(Arrays.asList(testReadState, readState2));
        when(messageRepository.countUnreadMessagesInChannel(eq(1L), any(LocalDateTime.class))).thenReturn(5);
        when(messageRepository.countUnreadMessagesInChannel(eq(2L), any(LocalDateTime.class))).thenReturn(10);

        // When
        Map<Long, Integer> unreadCounts = channelReadStateService.getUnreadCountsForUser(1L);

        // Then
        assertThat(unreadCounts).hasSize(2);
        assertThat(unreadCounts.get(1L)).isEqualTo(5);
        assertThat(unreadCounts.get(2L)).isEqualTo(10);
    }

    @Test
    @DisplayName("getUnreadCountsForUser should count all messages for channels never read")
    void getUnreadCountsForUser_NeverReadChannel_ShouldCountAllMessages() {
        // Given
        Channel channel2 = Channel.builder()
                .id(2L)
                .name("new-channel")
                .channelType(ChannelType.TEXT)
                .build();

        List<Channel> channels = Arrays.asList(testChannel, channel2);
        
        // Only have read state for channel 1, not channel 2
        when(channelRepository.findAll()).thenReturn(channels);
        when(readStateRepository.findByUserId(1L)).thenReturn(Collections.singletonList(testReadState));
        when(messageRepository.countUnreadMessagesInChannel(eq(1L), any(LocalDateTime.class))).thenReturn(5);
        when(messageRepository.countAllMessagesInChannel(2L)).thenReturn(150); // More than cap

        // When
        Map<Long, Integer> unreadCounts = channelReadStateService.getUnreadCountsForUser(1L);

        // Then
        assertThat(unreadCounts).hasSize(2);
        assertThat(unreadCounts.get(1L)).isEqualTo(5);
        assertThat(unreadCounts.get(2L)).isEqualTo(99); // Capped at 99
    }

    @Test
    @DisplayName("getUnreadCountForChannel should return correct count for existing state")
    void getUnreadCountForChannel_ExistingState_ShouldReturnCount() {
        // Given
        when(currentUserService.getCurrentUserIdOrThrow()).thenReturn(1L);
        when(readStateRepository.findByUserIdAndChannelId(1L, 1L)).thenReturn(Optional.of(testReadState));
        when(messageRepository.countUnreadMessagesInChannel(eq(1L), any(LocalDateTime.class))).thenReturn(7);

        // When
        int unreadCount = channelReadStateService.getUnreadCountForChannel(1L);

        // Then
        assertThat(unreadCount).isEqualTo(7);
    }

    @Test
    @DisplayName("getUnreadCountForChannel should return all messages count for never-read channel")
    void getUnreadCountForChannel_NeverRead_ShouldReturnAllMessagesCount() {
        // Given
        when(currentUserService.getCurrentUserIdOrThrow()).thenReturn(1L);
        when(readStateRepository.findByUserIdAndChannelId(1L, 1L)).thenReturn(Optional.empty());
        when(messageRepository.countAllMessagesInChannel(1L)).thenReturn(50);

        // When
        int unreadCount = channelReadStateService.getUnreadCountForChannel(1L);

        // Then
        assertThat(unreadCount).isEqualTo(50);
    }

    @Test
    @DisplayName("getUnreadCountsAsList should return list format")
    void getUnreadCountsAsList_ShouldReturnListFormat() {
        // Given
        when(currentUserService.getCurrentUserIdOrThrow()).thenReturn(1L);
        when(channelRepository.findAll()).thenReturn(Collections.singletonList(testChannel));
        when(readStateRepository.findByUserId(1L)).thenReturn(Collections.singletonList(testReadState));
        when(messageRepository.countUnreadMessagesInChannel(eq(1L), any(LocalDateTime.class))).thenReturn(3);

        // When
        List<UnreadCountResponse> result = channelReadStateService.getUnreadCountsAsList();

        // Then
        assertThat(result).hasSize(1);
        assertThat(result.get(0).getChannelId()).isEqualTo(1L);
        assertThat(result.get(0).getUnreadCount()).isEqualTo(3);
    }

    @Test
    @DisplayName("initializeReadStatesForUser should create states for channels without state")
    void initializeReadStatesForUser_ShouldCreateMissingStates() {
        // Given
        Channel channel2 = Channel.builder()
                .id(2L)
                .name("new-channel")
                .channelType(ChannelType.TEXT)
                .build();

        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(channelRepository.findAll()).thenReturn(Arrays.asList(testChannel, channel2));
        when(readStateRepository.findChannelIdsByUserId(1L)).thenReturn(Collections.singletonList(1L)); // Only channel 1

        // When
        channelReadStateService.initializeReadStatesForUser(1L);

        // Then
        verify(readStateRepository).save(argThat(state ->
            state.getChannel().getId().equals(2L) &&
            state.getUser().getId().equals(1L)
        ));
    }

    @Test
    @DisplayName("initializeReadStatesForChannel should create states for all users")
    void initializeReadStatesForChannel_ShouldCreateStatesForAllUsers() {
        // Given
        User user2 = User.builder()
                .id(2L)
                .username("user2")
                .email("user2@example.com")
                .password("password")
                .build();

        when(channelRepository.findById(1L)).thenReturn(Optional.of(testChannel));
        when(userRepository.findAll()).thenReturn(Arrays.asList(testUser, user2));
        when(readStateRepository.findByUserIdAndChannelId(1L, 1L)).thenReturn(Optional.of(testReadState));
        when(readStateRepository.findByUserIdAndChannelId(2L, 1L)).thenReturn(Optional.empty());

        // When
        channelReadStateService.initializeReadStatesForChannel(1L);

        // Then
        verify(readStateRepository).save(argThat(state ->
            state.getUser().getId().equals(2L) &&
            state.getChannel().getId().equals(1L)
        ));
        verify(readStateRepository, never()).save(argThat(state -> 
            state.getUser().getId().equals(1L)
        ));
    }

    @Test
    @DisplayName("deleteReadStatesForChannel should delete all states for channel")
    void deleteReadStatesForChannel_ShouldDeleteAllStates() {
        // When
        channelReadStateService.deleteReadStatesForChannel(1L);

        // Then
        verify(readStateRepository).deleteByChannelId(1L);
    }
}
