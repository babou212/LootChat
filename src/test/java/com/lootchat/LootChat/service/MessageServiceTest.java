package com.lootchat.LootChat.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lootchat.LootChat.dto.message.MessageResponse;
import com.lootchat.LootChat.dto.message.ReactionResponse;
import com.lootchat.LootChat.entity.*;
import com.lootchat.LootChat.repository.ChannelRepository;
import com.lootchat.LootChat.repository.MessageReactionRepository;
import com.lootchat.LootChat.repository.MessageRepository;
import com.lootchat.LootChat.repository.UserRepository;
import com.lootchat.LootChat.security.CurrentUserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("MessageService Tests")
class MessageServiceTest {

    @Mock
    private MessageRepository messageRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ChannelRepository channelRepository;

    @Mock
    private MessageReactionRepository reactionRepository;

    @Mock
    private CurrentUserService currentUserService;

    @Mock
    private S3FileStorageService s3FileStorageService;

    @Mock
    private OutboxService outboxService;

    @Mock
    private ObjectMapper objectMapper;

    @Mock
    private CacheManager cacheManager;

    @Mock
    private Cache channelMessagesCache;

    @Mock
    private Cache paginatedCache;

    @InjectMocks
    private MessageService messageService;

    private User testUser;
    private User moderatorUser;
    private Channel testChannel;
    private Message testMessage;

    @BeforeEach
    void setUp() {
        testUser = User.builder()
                .id(1L)
                .username("testuser")
                .email("test@example.com")
                .role(Role.USER)
                .build();

        moderatorUser = User.builder()
                .id(2L)
                .username("moderator")
                .email("mod@example.com")
                .role(Role.MODERATOR)
                .build();

        testChannel = Channel.builder()
                .id(1L)
                .name("general")
                .description("General discussion")
                .channelType(ChannelType.TEXT)
                .build();

        testMessage = Message.builder()
                .id(1L)
                .content("Test message")
                .user(testUser)
                .channel(testChannel)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
    }

    @Test
    @DisplayName("createMessage should create message with channel")
    void createMessage_ShouldCreateMessage_WithChannel() throws Exception {
        when(currentUserService.getCurrentUserIdOrThrow()).thenReturn(1L);
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(channelRepository.findById(1L)).thenReturn(Optional.of(testChannel));
        when(messageRepository.save(any(Message.class))).thenAnswer(invocation -> {
            Message msg = invocation.getArgument(0);
            msg.setId(1L);
            return msg;
        });
        when(reactionRepository.findByMessageId(1L)).thenReturn(Collections.emptyList());
        when(cacheManager.getCache("channelMessagesPaginated")).thenReturn(paginatedCache);

        MessageResponse result = messageService.createMessage("Test message", 1L);

        assertThat(result).isNotNull();
        assertThat(result.getContent()).isEqualTo("Test message");
        assertThat(result.getChannelId()).isEqualTo(1L);
        verify(messageRepository, times(1)).save(any(Message.class));
        verify(outboxService).saveEvent(any(), any(), any(), any());
    }

    @Test
    @DisplayName("createMessage should throw exception when user not found")
    void createMessage_ShouldThrowException_WhenUserNotFound() {
        when(currentUserService.getCurrentUserIdOrThrow()).thenReturn(999L);
        when(userRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> messageService.createMessage("Test", 1L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("User not found with id: 999")
                .extracting("status")
                .isEqualTo(HttpStatus.UNAUTHORIZED);

        verify(messageRepository, never()).save(any());
    }

    @Test
    @DisplayName("createMessage should throw exception when channel not found")
    void createMessage_ShouldThrowException_WhenChannelNotFound() {
        when(currentUserService.getCurrentUserIdOrThrow()).thenReturn(1L);
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(channelRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> messageService.createMessage("Test", 999L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Channel not found with id: 999")
                .extracting("status")
                .isEqualTo(HttpStatus.NOT_FOUND);

        verify(messageRepository, never()).save(any());
    }

    @Test
    @DisplayName("createMessageWithImage should create message with image attachment")
    void createMessageWithImage_ShouldCreateMessage_WithImage() throws Exception {
        MockMultipartFile image = new MockMultipartFile(
                "image",
                "test.jpg",
                "image/jpeg",
                "image data".getBytes()
        );

        when(currentUserService.getCurrentUserIdOrThrow()).thenReturn(1L);
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(channelRepository.findById(1L)).thenReturn(Optional.of(testChannel));
        when(s3FileStorageService.storeFile(image)).thenReturn("test-image.jpg");
        when(messageRepository.save(any(Message.class))).thenAnswer(invocation -> {
            Message msg = invocation.getArgument(0);
            msg.setId(1L);
            return msg;
        });
        when(reactionRepository.findByMessageId(1L)).thenReturn(Collections.emptyList());
        when(cacheManager.getCache("channelMessagesPaginated")).thenReturn(paginatedCache);

        MessageResponse result = messageService.createMessageWithImage("Message with image", 1L, image);

        assertThat(result).isNotNull();
        assertThat(result.getContent()).isEqualTo("Message with image");
        assertThat(result.getImageUrl()).isEqualTo("/api/files/images/test-image.jpg");
        verify(s3FileStorageService, times(1)).storeFile(image);
        verify(messageRepository, times(1)).save(any(Message.class));
        verify(outboxService).saveEvent(any(), any(), any(), any());
    }

    @Test
    @DisplayName("getMessagesByChannelIdCursor should return messages in correct order")
    void getMessagesByChannelIdCursor_ShouldReturnMessages_InCorrectOrder() {
        Message msg1 = Message.builder().id(1L).content("Message 1").user(testUser).channel(testChannel).build();
        Message msg2 = Message.builder().id(2L).content("Message 2").user(testUser).channel(testChannel).build();
        Message msg3 = Message.builder().id(3L).content("Message 3").user(testUser).channel(testChannel).build();

        // Cursor-based returns messages before a given ID, ordered by id desc
        when(messageRepository.findByChannelIdAndIdLessThanOrderByIdDesc(eq(1L), eq(100L), any(Pageable.class)))
                .thenReturn(Arrays.asList(msg3, msg2, msg1));
        when(reactionRepository.findByMessageId(anyLong())).thenReturn(Collections.emptyList());

        List<MessageResponse> result = messageService.getMessagesByChannelIdCursor(1L, 100L, 50);

        assertThat(result).hasSize(3);
        // Results are reversed in the service to show oldest first
        assertThat(result.get(0).getId()).isEqualTo(1L);
        assertThat(result.get(1).getId()).isEqualTo(2L);
        assertThat(result.get(2).getId()).isEqualTo(3L);
    }

    @Test
    @DisplayName("updateMessage should update message content and evict cache")
    void updateMessage_ShouldUpdateMessage_AndEvictCache() throws Exception {
        when(messageRepository.findById(1L)).thenReturn(Optional.of(testMessage));
        when(currentUserService.getCurrentUserIdOrThrow()).thenReturn(1L);
        when(messageRepository.save(any(Message.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(reactionRepository.findByMessageId(1L)).thenReturn(Collections.emptyList());

        MessageResponse result = messageService.updateMessage(1L, "Updated content");

        assertThat(result.getContent()).isEqualTo("Updated content");
        verify(messageRepository, times(1)).save(testMessage);
        verify(outboxService).saveEvent(any(), any(), any(), any());
    }

    @Test
    @DisplayName("updateMessage should throw exception when user is not message owner")
    void updateMessage_ShouldThrowException_WhenNotOwner() {
        when(messageRepository.findById(1L)).thenReturn(Optional.of(testMessage));
        when(currentUserService.getCurrentUserIdOrThrow()).thenReturn(999L); // Different user

        assertThatThrownBy(() -> messageService.updateMessage(1L, "Updated"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("You cannot edit this message")
                .extracting("status")
                .isEqualTo(HttpStatus.FORBIDDEN);

        verify(messageRepository, never()).save(any());
    }

    @Test
    @DisplayName("deleteMessage should allow owner to delete their message (soft delete)")
    void deleteMessage_ShouldAllow_OwnerToDelete() throws Exception {
        when(messageRepository.findById(1L)).thenReturn(Optional.of(testMessage));
        when(currentUserService.getCurrentUserOrThrow()).thenReturn(testUser);
        when(messageRepository.save(any(Message.class))).thenReturn(testMessage);

        messageService.deleteMessage(1L);

        verify(reactionRepository, times(1)).deleteByMessageId(1L);
        verify(messageRepository, times(1)).save(any(Message.class)); // Soft delete saves
        verify(messageRepository, never()).deleteById(any()); // No hard delete
        verify(outboxService).saveEvent(any(), any(), any(), any());
    }

    @Test
    @DisplayName("deleteMessage should allow moderator to delete any message (soft delete)")
    void deleteMessage_ShouldAllow_ModeratorToDelete() throws Exception {
        when(messageRepository.findById(1L)).thenReturn(Optional.of(testMessage));
        when(currentUserService.getCurrentUserOrThrow()).thenReturn(moderatorUser);
        when(messageRepository.save(any(Message.class))).thenReturn(testMessage);

        messageService.deleteMessage(1L);

        verify(messageRepository, times(1)).save(any(Message.class)); // Soft delete saves
        verify(messageRepository, never()).deleteById(any()); // No hard delete
        verify(outboxService).saveEvent(any(), any(), any(), any());
    }

    @Test
    @DisplayName("deleteMessage should delete image file when message has image")
    void deleteMessage_ShouldDeleteImageFile_WhenMessageHasImage() throws Exception {
        testMessage.setImageFilename("test-image.jpg");
        when(messageRepository.findById(1L)).thenReturn(Optional.of(testMessage));
        when(currentUserService.getCurrentUserOrThrow()).thenReturn(testUser);
        when(messageRepository.save(any(Message.class))).thenReturn(testMessage);

        messageService.deleteMessage(1L);

        verify(s3FileStorageService, times(1)).deleteFile("test-image.jpg");
        verify(messageRepository, times(1)).save(any(Message.class)); // Soft delete saves
        verify(messageRepository, never()).deleteById(any()); // No hard delete
        verify(outboxService).saveEvent(any(), any(), any(), any());
    }

    @Test
    @DisplayName("deleteMessage should throw exception when user is not authorized")
    void deleteMessage_ShouldThrowException_WhenNotAuthorized() {
        User unauthorizedUser = User.builder()
                .id(999L)
                .username("unauthorized")
                .role(Role.USER)
                .build();

        when(messageRepository.findById(1L)).thenReturn(Optional.of(testMessage));
        when(currentUserService.getCurrentUserOrThrow()).thenReturn(unauthorizedUser);

        assertThatThrownBy(() -> messageService.deleteMessage(1L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("You cannot delete this message")
                .extracting("status")
                .isEqualTo(HttpStatus.FORBIDDEN);

        verify(messageRepository, never()).deleteById(any());
        verify(messageRepository, never()).save(any()); // Soft delete also not called
    }

    @Test
    @DisplayName("deleteMessage should be idempotent for already deleted messages")
    void deleteMessage_ShouldBeIdempotent_WhenAlreadyDeleted() throws Exception {
        testMessage.setDeleted(true);
        when(messageRepository.findById(1L)).thenReturn(Optional.of(testMessage));

        messageService.deleteMessage(1L);

        // Should not attempt to delete again
        verify(reactionRepository, never()).deleteByMessageId(any());
        verify(messageRepository, never()).save(any());
        verify(outboxService, never()).saveEvent(any(), any(), any(), any());
    }

    @Test
    @DisplayName("updateMessage should throw GONE when message is deleted")
    void updateMessage_ShouldThrowGone_WhenMessageDeleted() {
        testMessage.setDeleted(true);
        when(messageRepository.findById(1L)).thenReturn(Optional.of(testMessage));

        assertThatThrownBy(() -> messageService.updateMessage(1L, "Updated content"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Cannot edit a deleted message")
                .extracting("status")
                .isEqualTo(HttpStatus.GONE);

        verify(messageRepository, never()).save(any());
    }

    @Test
    @DisplayName("addReaction should throw GONE when message is deleted")
    void addReaction_ShouldThrowGone_WhenMessageDeleted() {
        testMessage.setDeleted(true);
        when(currentUserService.getCurrentUserIdOrThrow()).thenReturn(1L);
        when(messageRepository.findById(1L)).thenReturn(Optional.of(testMessage));

        assertThatThrownBy(() -> messageService.addReaction(1L, "👍"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Cannot add reaction to a deleted message")
                .extracting("status")
                .isEqualTo(HttpStatus.GONE);

        verify(reactionRepository, never()).save(any());
    }

    @Test
    @DisplayName("mapToMessageResponse should show deleted placeholder for deleted messages")
    void getMessageById_ShouldShowDeletedPlaceholder_WhenMessageDeleted() {
        testMessage.setDeleted(true);
        testMessage.setContent(""); // Content cleared on soft delete
        when(messageRepository.findById(1L)).thenReturn(Optional.of(testMessage));

        MessageResponse result = messageService.getMessageById(1L);

        assertThat(result).isNotNull();
        assertThat(result.isDeleted()).isTrue();
        assertThat(result.getContent()).isEqualTo("[Message deleted]");
        assertThat(result.getReactions()).isEmpty();
    }

    @Test
    @DisplayName("addReaction should add reaction to message")
    void addReaction_ShouldAddReaction() throws Exception {
        when(currentUserService.getCurrentUserIdOrThrow()).thenReturn(1L);
        when(messageRepository.findById(1L)).thenReturn(Optional.of(testMessage));
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(reactionRepository.findByMessageIdAndUserIdAndEmoji(1L, 1L, "👍")).thenReturn(Optional.empty());
        when(reactionRepository.save(any(MessageReaction.class))).thenAnswer(invocation -> {
            MessageReaction reaction = invocation.getArgument(0);
            reaction.setId(1L);
            return reaction;
        });

        ReactionResponse result = messageService.addReaction(1L, "👍");

        assertThat(result).isNotNull();
        assertThat(result.getEmoji()).isEqualTo("👍");
        verify(reactionRepository, times(1)).save(any(MessageReaction.class));
        verify(outboxService).saveEvent(any(), any(), any(), any());
    }

    @Test
    @DisplayName("addReaction should throw exception when reaction already exists")
    void addReaction_ShouldThrowException_WhenReactionExists() {
        MessageReaction existingReaction = MessageReaction.builder()
                .id(1L)
                .emoji("👍")
                .user(testUser)
                .message(testMessage)
                .build();

        when(currentUserService.getCurrentUserIdOrThrow()).thenReturn(1L);
        when(messageRepository.findById(1L)).thenReturn(Optional.of(testMessage));
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(reactionRepository.findByMessageIdAndUserIdAndEmoji(1L, 1L, "👍"))
                .thenReturn(Optional.of(existingReaction));

        assertThatThrownBy(() -> messageService.addReaction(1L, "👍"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Reaction already exists")
                .extracting("status")
                .isEqualTo(HttpStatus.CONFLICT);

        verify(reactionRepository, never()).save(any());
    }

    @Test
    @DisplayName("removeReaction should remove reaction from message")
    void removeReaction_ShouldRemoveReaction() throws Exception {
        MessageReaction reaction = MessageReaction.builder()
                .id(1L)
                .emoji("👍")
                .user(testUser)
                .message(testMessage)
                .build();

        when(currentUserService.getCurrentUserIdOrThrow()).thenReturn(1L);
        when(reactionRepository.findByMessageIdAndUserIdAndEmoji(1L, 1L, "👍"))
                .thenReturn(Optional.of(reaction));
        when(messageRepository.findById(1L)).thenReturn(Optional.of(testMessage));

        messageService.removeReaction(1L, "👍");

        verify(reactionRepository, times(1)).delete(reaction);
        verify(outboxService).saveEvent(any(), any(), any(), any());
    }

    @Test
    @DisplayName("removeReaction should throw exception when reaction not found")
    void removeReaction_ShouldThrowException_WhenReactionNotFound() {
        when(currentUserService.getCurrentUserIdOrThrow()).thenReturn(1L);
        when(reactionRepository.findByMessageIdAndUserIdAndEmoji(1L, 1L, "👍"))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> messageService.removeReaction(1L, "👍"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Reaction not found")
                .extracting("status")
                .isEqualTo(HttpStatus.NOT_FOUND);

        verify(reactionRepository, never()).delete(any());
    }

    @Test
    @DisplayName("getMessageById should return message when found")
    void getMessageById_ShouldReturnMessage_WhenFound() {
        when(messageRepository.findById(1L)).thenReturn(Optional.of(testMessage));
        when(reactionRepository.findByMessageId(1L)).thenReturn(Collections.emptyList());

        MessageResponse result = messageService.getMessageById(1L);

        assertThat(result).isNotNull();
        assertThat(result.getId()).isEqualTo(1L);
        assertThat(result.getContent()).isEqualTo("Test message");
        verify(messageRepository, times(1)).findById(1L);
    }

    @Test
    @DisplayName("getMessageById should throw exception when message not found")
    void getMessageById_ShouldThrowException_WhenNotFound() {
        when(messageRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> messageService.getMessageById(999L))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Message not found with id: 999");
    }
}
