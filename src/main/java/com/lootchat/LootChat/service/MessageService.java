package com.lootchat.LootChat.service;

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
import org.springframework.messaging.simp.SimpMessagingTemplate;
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

    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final ChannelRepository channelRepository;
    private final MessageReactionRepository reactionRepository;
    private final CurrentUserService currentUserService;
    private final SimpMessagingTemplate messagingTemplate;
    private final FileStorageService fileStorageService;

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
        
        // Broadcast new message to all connected WebSocket clients
        messagingTemplate.convertAndSend("/topic/messages", response);
        
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
        
        // Broadcast new message to channel-specific topic
        messagingTemplate.convertAndSend("/topic/channels/" + channelId + "/messages", response);
        
        // Also broadcast to the global topic for notifications
        messagingTemplate.convertAndSend("/topic/messages", response);
        
        return response;
    }

    @Transactional
    public MessageResponse createMessageWithImage(String content, Long channelId, MultipartFile image) {
        Long userId = currentUserService.getCurrentUserIdOrThrow();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found with id: " + userId));

        Channel channel = channelRepository.findById(channelId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Channel not found with id: " + channelId));

        // Store the image file
        String imageFilename = fileStorageService.storeFile(image);
        String imageUrl = "/api/files/images/" + imageFilename;

        // Use empty string if content is null
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
        
        // Broadcast new message to channel-specific topic
        messagingTemplate.convertAndSend("/topic/channels/" + channelId + "/messages", response);
        
        // Also broadcast to the global topic for notifications
        messagingTemplate.convertAndSend("/topic/messages", response);
        
        return response;
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
        
        // Broadcast updated message
        if (updatedMessage.getChannel() != null) {
            messagingTemplate.convertAndSend("/topic/channels/" + updatedMessage.getChannel().getId() + "/messages", response);
            // Also broadcast to global topic for notifications
            messagingTemplate.convertAndSend("/topic/messages", response);
        } else {
            messagingTemplate.convertAndSend("/topic/messages", response);
        }
        
        return response;
    }

    @Transactional
    public void deleteMessage(Long id) {
        Message message = messageRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Message not found with id: " + id));
        // Load current user (includes role)
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

        var deletionPayload = java.util.Map.of(
                "id", id,
                "channelId", channelId
        );
        messagingTemplate.convertAndSend("/topic/messages/delete", deletionPayload);
        if (channelId != null) {
            messagingTemplate.convertAndSend("/topic/channels/" + channelId + "/messages/delete", deletionPayload);
        }
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

        if (message.getChannel() != null) {
            messagingTemplate.convertAndSend("/topic/channels/" + message.getChannel().getId() + "/reactions", response);
        }
        messagingTemplate.convertAndSend("/topic/reactions", response);

        return response;
    }

    @Transactional
    public void removeReaction(Long messageId, String emoji) {
        Long userId = currentUserService.getCurrentUserIdOrThrow();

        MessageReaction reaction = reactionRepository.findByMessageIdAndUserIdAndEmoji(messageId, userId, emoji)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reaction not found"));

        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Message not found with id: " + messageId));

        reactionRepository.delete(reaction);

        ReactionResponse response = mapToReactionResponse(reaction);
        if (message.getChannel() != null) {
            messagingTemplate.convertAndSend("/topic/channels/" + message.getChannel().getId() + "/reactions/remove", response);
        }
        messagingTemplate.convertAndSend("/topic/reactions/remove", response);
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
