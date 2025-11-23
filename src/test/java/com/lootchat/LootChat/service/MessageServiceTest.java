package com.lootchat.LootChat.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lootchat.LootChat.dto.MessageResponse;
import com.lootchat.LootChat.dto.ReactionResponse;
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
    private KafkaProducerService kafkaProducerService;

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
        when(objectMapper.writeValueAsString(any())).thenReturn("{}");

        MessageResponse result = messageService.createMessage("Test message", 1L);

        assertThat(result).isNotNull();
        assertThat(result.getContent()).isEqualTo("Test message");
        assertThat(result.getChannelId()).isEqualTo(1L);
        verify(messageRepository, times(1)).save(any(Message.class));
        verify(kafkaProducerService, times(1)).send(any(), any(), any());
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
        when(objectMapper.writeValueAsString(any())).thenReturn("{}");

        MessageResponse result = messageService.createMessageWithImage("Message with image", 1L, image);

        assertThat(result).isNotNull();
        assertThat(result.getContent()).isEqualTo("Message with image");
        assertThat(result.getImageUrl()).isEqualTo("/api/files/images/test-image.jpg");
        verify(s3FileStorageService, times(1)).storeFile(image);
        verify(messageRepository, times(1)).save(any(Message.class));
    }

    @Test
    @DisplayName("getMessagesByChannelIdPaginated should return messages in correct order")
    void getMessagesByChannelIdPaginated_ShouldReturnMessages_InCorrectOrder() {
        Message msg1 = Message.builder().id(1L).content("Message 1").user(testUser).channel(testChannel).build();
        Message msg2 = Message.builder().id(2L).content("Message 2").user(testUser).channel(testChannel).build();
        Message msg3 = Message.builder().id(3L).content("Message 3").user(testUser).channel(testChannel).build();

        Page<Message> messagePage = new PageImpl<>(Arrays.asList(msg3, msg2, msg1)); // Descending order
        when(messageRepository.findByChannelIdOrderByCreatedAtDesc(eq(1L), any(Pageable.class)))
                .thenReturn(messagePage);
        when(reactionRepository.findByMessageId(anyLong())).thenReturn(Collections.emptyList());

        List<MessageResponse> result = messageService.getMessagesByChannelIdPaginated(1L, 0, 50);


        assertThat(result).hasSize(3);
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
        when(cacheManager.getCache("channelMessages")).thenReturn(channelMessagesCache);
        when(cacheManager.getCache("channelMessagesPaginated")).thenReturn(paginatedCache);
        when(objectMapper.writeValueAsString(any())).thenReturn("{}");

        MessageResponse result = messageService.updateMessage(1L, "Updated content");

        assertThat(result.getContent()).isEqualTo("Updated content");
        verify(messageRepository, times(1)).save(testMessage);
        verify(channelMessagesCache, times(1)).evict("channel:1");
        verify(paginatedCache, times(1)).clear();
        verify(kafkaProducerService, times(1)).send(any(), any(), any());
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
    @DisplayName("deleteMessage should allow owner to delete their message")
    void deleteMessage_ShouldAllow_OwnerToDelete() throws Exception {
        when(messageRepository.findById(1L)).thenReturn(Optional.of(testMessage));
        when(currentUserService.getCurrentUserOrThrow()).thenReturn(testUser);
        when(cacheManager.getCache("channelMessages")).thenReturn(channelMessagesCache);
        when(cacheManager.getCache("channelMessagesPaginated")).thenReturn(paginatedCache);
        when(objectMapper.writeValueAsString(any())).thenReturn("{}");

        messageService.deleteMessage(1L);

        verify(reactionRepository, times(1)).deleteByMessageId(1L);
        verify(messageRepository, times(1)).deleteById(1L);
        verify(channelMessagesCache, times(1)).evict("channel:1");
        verify(paginatedCache, times(1)).clear();
        verify(kafkaProducerService, times(1)).send(any(), any(), any());
    }

    @Test
    @DisplayName("deleteMessage should allow moderator to delete any message")
    void deleteMessage_ShouldAllow_ModeratorToDelete() throws Exception {
        when(messageRepository.findById(1L)).thenReturn(Optional.of(testMessage));
        when(currentUserService.getCurrentUserOrThrow()).thenReturn(moderatorUser);
        when(cacheManager.getCache("channelMessages")).thenReturn(channelMessagesCache);
        when(cacheManager.getCache("channelMessagesPaginated")).thenReturn(paginatedCache);
        when(objectMapper.writeValueAsString(any())).thenReturn("{}");

        messageService.deleteMessage(1L);

        verify(messageRepository, times(1)).deleteById(1L);
    }

    @Test
    @DisplayName("deleteMessage should delete image file when message has image")
    void deleteMessage_ShouldDeleteImageFile_WhenMessageHasImage() throws Exception {
        testMessage.setImageFilename("test-image.jpg");
        when(messageRepository.findById(1L)).thenReturn(Optional.of(testMessage));
        when(currentUserService.getCurrentUserOrThrow()).thenReturn(testUser);
        when(cacheManager.getCache("channelMessages")).thenReturn(channelMessagesCache);
        when(cacheManager.getCache("channelMessagesPaginated")).thenReturn(paginatedCache);
        when(objectMapper.writeValueAsString(any())).thenReturn("{}");

        messageService.deleteMessage(1L);

        verify(s3FileStorageService, times(1)).deleteFile("test-image.jpg");
        verify(messageRepository, times(1)).deleteById(1L);
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
        when(cacheManager.getCache("channelMessages")).thenReturn(channelMessagesCache);
        when(cacheManager.getCache("channelMessagesPaginated")).thenReturn(paginatedCache);
        when(objectMapper.writeValueAsString(any())).thenReturn("{}");

        ReactionResponse result = messageService.addReaction(1L, "👍");

        assertThat(result).isNotNull();
        assertThat(result.getEmoji()).isEqualTo("👍");
        verify(reactionRepository, times(1)).save(any(MessageReaction.class));
        verify(channelMessagesCache, times(1)).evict("channel:1");
        verify(kafkaProducerService, times(1)).send(any(), any(), any());
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
        when(cacheManager.getCache("channelMessages")).thenReturn(channelMessagesCache);
        when(cacheManager.getCache("channelMessagesPaginated")).thenReturn(paginatedCache);
        when(objectMapper.writeValueAsString(any())).thenReturn("{}");

        messageService.removeReaction(1L, "👍");

        verify(reactionRepository, times(1)).delete(reaction);
        verify(channelMessagesCache, times(1)).evict("channel:1");
        verify(kafkaProducerService, times(1)).send(any(), any(), any());
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
