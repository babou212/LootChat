package com.lootchat.LootChat.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lootchat.LootChat.dto.*;
import com.lootchat.LootChat.dto.MessageResponse;
import com.lootchat.LootChat.dto.ReactionResponse;
import com.lootchat.LootChat.entity.Channel;
import com.lootchat.LootChat.entity.Message;
import com.lootchat.LootChat.entity.MessageReaction;
import com.lootchat.LootChat.entity.User;
import com.lootchat.LootChat.repository.ChannelRepository;
import com.lootchat.LootChat.repository.MessageReactionRepository;
import com.lootchat.LootChat.repository.MessageRepository;
import com.lootchat.LootChat.repository.UserRepository;
import com.lootchat.LootChat.security.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MessageService {

    private static final Logger log = LoggerFactory.getLogger(MessageService.class);

    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final ChannelRepository channelRepository;
    private final MessageReactionRepository reactionRepository;
    private final CurrentUserService currentUserService;
    private final FileStorageService fileStorageService;
    private final KafkaProducerService kafkaProducerService;
    private final ObjectMapper objectMapper;

    @Transactional
    public MessageResponse createMessage(String content) {
        Long userId = currentUserService.getCurrentUserIdOrThrow();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found with id: " + userId));

        Message message = Message.builder()
                .content(content)
                .user(user)
                .build();

        Message savedMessage = messageRepository.save(message);
        MessageResponse response = mapToMessageResponse(savedMessage);
        
        publishMessageToKafka(savedMessage.getId(), content, null, userId);
        
        return response;
    }

    @Transactional
    public MessageResponse createMessage(String content, Long channelId) {
        Long userId = currentUserService.getCurrentUserIdOrThrow();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found with id: " + userId));

        Channel channel = channelRepository.findById(channelId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Channel not found with id: " + channelId));

        Message message = Message.builder()
                .content(content)
                .user(user)
                .channel(channel)
                .build();

        Message savedMessage = messageRepository.save(message);
        MessageResponse response = mapToMessageResponse(savedMessage);
        
        publishMessageToKafka(savedMessage.getId(), content, channelId, userId);
        
        return response;
    }

    @Transactional
    public MessageResponse createMessageWithImage(String content, Long channelId, MultipartFile image) {
        Long userId = currentUserService.getCurrentUserIdOrThrow();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found with id: " + userId));

        Channel channel = channelRepository.findById(channelId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Channel not found with id: " + channelId));

        String imageFilename = fileStorageService.storeFile(image);
        String imageUrl = "/api/files/images/" + imageFilename;

        String messageContent = content != null ? content : "";

        Message message = Message.builder()
                .content(messageContent)
                .user(user)
                .channel(channel)
                .imageUrl(imageUrl)
                .imageFilename(imageFilename)
                .build();

        Message savedMessage = messageRepository.save(message);
        MessageResponse response = mapToMessageResponse(savedMessage);
        
        publishMessageToKafka(savedMessage.getId(), messageContent, channelId, userId);
        
        return response;
    }

    private void publishMessageToKafka(Long messageId, String content, Long channelId, Long userId) {
        try {
            ChatMessageEvent event = new ChatMessageEvent(messageId, content, channelId, userId);
            String payload = objectMapper.writeValueAsString(event);
            kafkaProducerService.send(null, null, payload);
            log.debug("Published message to Kafka: messageId={}, channelId={}, userId={}", messageId, channelId, userId);
        } catch (Exception e) {
            log.error("Failed to publish message to Kafka", e);
        }
    }

    private void publishMessageUpdateToKafka(Long messageId, String content, Long channelId) {
        try {
            MessageUpdateEvent event = new MessageUpdateEvent(messageId, content, channelId);
            String payload = objectMapper.writeValueAsString(event);
            kafkaProducerService.send(null, null, payload);
            log.debug("Published message update to Kafka: messageId={}, channelId={}", messageId, channelId);
        } catch (Exception e) {
            log.error("Failed to publish message update to Kafka", e);
        }
    }

    private void publishMessageDeleteToKafka(Long messageId, Long channelId) {
        try {
            MessageDeleteEvent event = new MessageDeleteEvent(messageId, channelId);
            String payload = objectMapper.writeValueAsString(event);
            kafkaProducerService.send(null, null, payload);
            log.debug("Published message delete to Kafka: messageId={}, channelId={}", messageId, channelId);
        } catch (Exception e) {
            log.error("Failed to publish message delete to Kafka", e);
        }
    }

    private void publishReactionToKafka(Long reactionId, Long messageId, Long channelId, String action, 
                                       String emoji, Long userId, String username) {
        try {
            ReactionEvent event = new ReactionEvent(reactionId, messageId, channelId, action, emoji, userId, username);
            String payload = objectMapper.writeValueAsString(event);
            kafkaProducerService.send(null, null, payload);
            log.debug("Published reaction {} to Kafka: reactionId={}, messageId={}, channelId={}", 
                action, reactionId, messageId, channelId);
        } catch (Exception e) {
            log.error("Failed to publish reaction to Kafka", e);
        }
    }

    @Transactional(readOnly = true)
    public List<MessageResponse> getAllMessages() {
        return messageRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::mapToMessageResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<MessageResponse> getMessagesByChannelId(Long channelId) {
        return messageRepository.findByChannelIdOrderByCreatedAtDesc(channelId).stream()
                .map(this::mapToMessageResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public MessageResponse getMessageById(Long id) {
        Message message = messageRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Message not found with id: " + id));
        return mapToMessageResponse(message);
    }

    @Transactional(readOnly = true)
    public List<MessageResponse> getMessagesForCurrentUser() {
        Long userId = currentUserService.getCurrentUserIdOrThrow();
        return messageRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(this::mapToMessageResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public MessageResponse updateMessage(Long id, String content) {
        Message message = messageRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Message not found with id: " + id));

        Long currentUserId = currentUserService.getCurrentUserIdOrThrow();
        if (!message.getUser().getId().equals(currentUserId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot edit this message");
        }

        message.setContent(content);
        Message updatedMessage = messageRepository.save(message);
        MessageResponse response = mapToMessageResponse(updatedMessage);
        
        publishMessageUpdateToKafka(updatedMessage.getId(), content, 
            updatedMessage.getChannel() != null ? updatedMessage.getChannel().getId() : null);
        
        return response;
    }

    @Transactional
    public void deleteMessage(Long id) {
        Message message = messageRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Message not found with id: " + id));

        User currentUser = currentUserService.getCurrentUserOrThrow();

        boolean isOwner = message.getUser().getId().equals(currentUser.getId());
        boolean isPrivileged = currentUser.getRole() == com.lootchat.LootChat.entity.Role.ADMIN || currentUser.getRole() == com.lootchat.LootChat.entity.Role.MODERATOR;
        if (!isOwner && !isPrivileged) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot delete this message");
        }

        reactionRepository.deleteByMessageId(id);

        if (message.getImageFilename() != null) {
            fileStorageService.deleteFile(message.getImageFilename());
        }
        Long channelId = message.getChannel() != null ? message.getChannel().getId() : null;
        messageRepository.deleteById(id);

        publishMessageDeleteToKafka(id, channelId);
    }

    private MessageResponse mapToMessageResponse(Message message) {
        List<ReactionResponse> reactions = reactionRepository.findByMessageId(message.getId())
                .stream()
                .map(this::mapToReactionResponse)
                .collect(Collectors.toList());

        return MessageResponse.builder()
                .id(message.getId())
                .content(message.getContent())
                .userId(message.getUser().getId())
                .username(message.getUser().getUsername())
                .avatar(message.getUser().getAvatar())
                .imageUrl(message.getImageUrl())
                .imageFilename(message.getImageFilename())
                .channelId(message.getChannel() != null ? message.getChannel().getId() : null)
                .channelName(message.getChannel() != null ? message.getChannel().getName() : null)
                .createdAt(message.getCreatedAt())
                .updatedAt(message.getUpdatedAt())
                .reactions(reactions)
                .build();
    }

    @Transactional
    public ReactionResponse addReaction(Long messageId, String emoji) {
        Long userId = currentUserService.getCurrentUserIdOrThrow();
        
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Message not found with id: " + messageId));

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found with id: " + userId));

        if (reactionRepository.findByMessageIdAndUserIdAndEmoji(messageId, userId, emoji).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Reaction already exists");
        }

        MessageReaction reaction = MessageReaction.builder()
                .emoji(emoji)
                .user(user)
                .message(message)
                .build();

        MessageReaction savedReaction = reactionRepository.save(reaction);
        ReactionResponse response = mapToReactionResponse(savedReaction);

        Long channelId = message.getChannel() != null ? message.getChannel().getId() : null;
        publishReactionToKafka(savedReaction.getId(), messageId, channelId, "add", 
            emoji, userId, user.getUsername());

        return response;
    }

    @Transactional
    public void removeReaction(Long messageId, String emoji) {
        Long userId = currentUserService.getCurrentUserIdOrThrow();

        MessageReaction reaction = reactionRepository.findByMessageIdAndUserIdAndEmoji(messageId, userId, emoji)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reaction not found"));

        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Message not found with id: " + messageId));

        Long channelId = message.getChannel() != null ? message.getChannel().getId() : null;
        Long reactionId = reaction.getId();
        String reactionEmoji = reaction.getEmoji();
        Long reactionUserId = reaction.getUser().getId();
        String reactionUsername = reaction.getUser().getUsername();
        
        reactionRepository.delete(reaction);

        publishReactionToKafka(reactionId, messageId, channelId, "remove", 
            reactionEmoji, reactionUserId, reactionUsername);
    }

    private ReactionResponse mapToReactionResponse(MessageReaction reaction) {
        return ReactionResponse.builder()
                .id(reaction.getId())
                .emoji(reaction.getEmoji())
                .userId(reaction.getUser().getId())
                .username(reaction.getUser().getUsername())
                .messageId(reaction.getMessage().getId())
                .createdAt(reaction.getCreatedAt())
                .build();
    }
}
