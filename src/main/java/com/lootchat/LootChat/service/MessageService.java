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
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.cache.CacheManager;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
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
    private final S3FileStorageService s3FileStorageService;
    private final OutboxService outboxService;
    private final ObjectMapper objectMapper;
    private final CacheManager cacheManager;
    private final SimpMessagingTemplate messagingTemplate;
    private final MentionService mentionService;

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
        return createMessage(content, channelId, null);
    }

    @Transactional
    public MessageResponse createMessage(String content, Long channelId, Long replyToMessageId) {
        Long userId = currentUserService.getCurrentUserIdOrThrow();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found with id: " + userId));

        Channel channel = channelRepository.findById(channelId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Channel not found with id: " + channelId));

        Message.MessageBuilder messageBuilder = Message.builder()
                .content(content)
                .user(user)
                .channel(channel);

        if (replyToMessageId != null) {
            Message replyToMessage = messageRepository.findById(replyToMessageId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reply message not found with id: " + replyToMessageId));
            messageBuilder.replyToMessage(replyToMessage)
                    .replyToUsername(replyToMessage.getUser().getUsername())
                    .replyToContent(replyToMessage.getContent());
        }

        Message message = messageBuilder.build();
        Message savedMessage = messageRepository.save(message);
        MessageResponse response = mapToMessageResponse(savedMessage);
        
        evictChannelFirstPageCache(channelId);
        
        publishMessageToKafka(savedMessage.getId(), content, channelId, userId);
        
        return response;
    }

    @Transactional
    public MessageResponse createMessageWithImage(String content, Long channelId, MultipartFile image) {
        return createMessageWithImage(content, channelId, image, null);
    }

    @Transactional
    public MessageResponse createMessageWithImage(String content, Long channelId, MultipartFile image, Long replyToMessageId) {
        Long userId = currentUserService.getCurrentUserIdOrThrow();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found with id: " + userId));

        Channel channel = channelRepository.findById(channelId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Channel not found with id: " + channelId));

        // Performance: Upload to S3 BEFORE transaction to avoid blocking DB commit
        // If S3 fails, entire transaction will rollback
        String imageFilename = s3FileStorageService.storeFile(image);
        String imageUrl = "/api/files/images/" + imageFilename;

        String messageContent = content != null ? content : "";

        Message.MessageBuilder messageBuilder = Message.builder()
                .content(messageContent)
                .user(user)
                .channel(channel)
                .imageUrl(imageUrl)
                .imageFilename(imageFilename);

        if (replyToMessageId != null) {
            Message replyToMessage = messageRepository.findById(replyToMessageId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reply message not found with id: " + replyToMessageId));
            messageBuilder.replyToMessage(replyToMessage)
                    .replyToUsername(replyToMessage.getUser().getUsername())
                    .replyToContent(replyToMessage.getContent());
        }

        Message message = messageBuilder.build();
        Message savedMessage = messageRepository.save(message);
        MessageResponse response = mapToMessageResponse(savedMessage);
        
        evictChannelFirstPageCache(channelId);
        
        publishMessageToKafka(savedMessage.getId(), messageContent, channelId, userId);
        
        return response;
    }

    /**
     * Broadcast message immediately via WebSocket for real-time updates on this pod,
     * then store in outbox for Kafka to sync across other pods.
     * 
     * This hybrid approach ensures:
     * 1. Immediate feedback for users on the same pod (low latency)
     * 2. Eventual consistency across all pods via Kafka inbox/outbox pattern
     */
    private void publishMessageToKafka(Long messageId, String content, Long channelId, Long userId) {
        // Immediate WebSocket broadcast for real-time experience
        broadcastMessageImmediately(messageId, channelId);
        
        try {
            Message message = messageRepository.findByIdWithUserAndChannel(messageId).orElse(null);
            if (message != null) {
                mentionService.processMentions(message);
            }
        } catch (Exception e) {
            log.warn("Failed to process mentions for message {}: {}", messageId, e.getMessage());
        }
        
        // Store in outbox for cross-pod consistency via Kafka
        ChatMessageEvent event = new ChatMessageEvent(messageId, content, channelId, userId);
        outboxService.saveEvent(
                OutboxService.EVENT_MESSAGE_CREATED,
                OutboxService.TOPIC_CHANNEL_MESSAGES,
                channelId != null ? channelId.toString() : null,
                event
        );
        log.debug("Stored message event in outbox: messageId={}, channelId={}, userId={}", messageId, channelId, userId);
    }
    
    /**
     * Broadcast message immediately via WebSocket without waiting for Kafka round-trip.
     */
    private void broadcastMessageImmediately(Long messageId, Long channelId) {
        try {
            Message message = messageRepository.findByIdWithUserAndChannel(messageId).orElse(null);
            if (message == null) {
                log.warn("Cannot broadcast - message not found: {}", messageId);
                return;
            }
            
            MessageResponse response = mapToMessageResponse(message);
            
            // Broadcast to channel-specific topic
            if (channelId != null) {
                messagingTemplate.convertAndSend("/topic/channels/" + channelId + "/messages", response);
            }
            // Broadcast to global messages topic
            messagingTemplate.convertAndSend("/topic/messages", response);
            
            log.debug("Immediately broadcast message: messageId={}, channelId={}", messageId, channelId);
        } catch (Exception e) {
            // Don't fail the transaction if broadcast fails - Kafka will handle it
            log.warn("Failed to immediately broadcast message {}: {}", messageId, e.getMessage());
        }
    }

    private void publishMessageUpdateToKafka(Long messageId, String content, Long channelId) {
        // Immediate WebSocket broadcast for real-time experience
        broadcastMessageUpdateImmediately(messageId, channelId);
        
        MessageUpdateEvent event = new MessageUpdateEvent(messageId, content, channelId);
        outboxService.saveEvent(
                OutboxService.EVENT_MESSAGE_EDITED,
                OutboxService.TOPIC_CHANNEL_MESSAGES,
                channelId != null ? channelId.toString() : null,
                event
        );
        log.debug("Stored message update event in outbox: messageId={}, channelId={}", messageId, channelId);
    }
    
    /**
     * Broadcast message update immediately via WebSocket.
     */
    private void broadcastMessageUpdateImmediately(Long messageId, Long channelId) {
        try {
            Message message = messageRepository.findByIdWithUserAndChannel(messageId).orElse(null);
            if (message == null) {
                log.warn("Cannot broadcast update - message not found: {}", messageId);
                return;
            }
            
            MessageResponse response = mapToMessageResponse(message);
            
            if (channelId != null) {
                messagingTemplate.convertAndSend("/topic/channels/" + channelId + "/messages", response);
            }
            messagingTemplate.convertAndSend("/topic/messages", response);
            
            log.debug("Immediately broadcast message update: messageId={}, channelId={}", messageId, channelId);
        } catch (Exception e) {
            log.warn("Failed to immediately broadcast message update {}: {}", messageId, e.getMessage());
        }
    }

    private void publishMessageDeleteToKafka(Long messageId, Long channelId) {
        // Immediate WebSocket broadcast for real-time experience
        broadcastMessageDeleteImmediately(messageId, channelId);
        
        MessageDeleteEvent event = new MessageDeleteEvent(messageId, channelId);
        outboxService.saveEvent(
                OutboxService.EVENT_MESSAGE_DELETED,
                OutboxService.TOPIC_CHANNEL_MESSAGES,
                channelId != null ? channelId.toString() : null,
                event
        );
        log.debug("Stored message delete event in outbox: messageId={}, channelId={}", messageId, channelId);
    }
    
    /**
     * Broadcast message deletion immediately via WebSocket.
     */
    private void broadcastMessageDeleteImmediately(Long messageId, Long channelId) {
        try {
            var deletionPayload = Map.of(
                    "id", messageId,
                    "channelId", channelId != null ? channelId : 0L
            );
            
            messagingTemplate.convertAndSend("/topic/messages/delete", deletionPayload);
            if (channelId != null) {
                messagingTemplate.convertAndSend("/topic/channels/" + channelId + "/messages/delete", deletionPayload);
            }
            
            log.debug("Immediately broadcast message delete: messageId={}, channelId={}", messageId, channelId);
        } catch (Exception e) {
            log.warn("Failed to immediately broadcast message delete {}: {}", messageId, e.getMessage());
        }
    }

    private void publishReactionToKafka(Long reactionId, Long messageId, Long channelId, String action, 
                                       String emoji, Long userId, String username) {
        // Immediate WebSocket broadcast for real-time experience
        broadcastReactionImmediately(reactionId, messageId, channelId, action, emoji, userId, username);
        
        ReactionEvent event = new ReactionEvent(reactionId, messageId, channelId, action, emoji, userId, username);
        String eventType = "add".equals(action) ? OutboxService.EVENT_REACTION_ADDED : OutboxService.EVENT_REACTION_REMOVED;
        outboxService.saveEvent(
                eventType,
                OutboxService.TOPIC_CHANNEL_MESSAGES,
                channelId != null ? channelId.toString() : null,
                event
        );
        log.debug("Stored reaction {} event in outbox: reactionId={}, messageId={}, channelId={}", 
            action, reactionId, messageId, channelId);
    }
    
    /**
     * Broadcast reaction immediately via WebSocket.
     */
    private void broadcastReactionImmediately(Long reactionId, Long messageId, Long channelId, 
                                              String action, String emoji, Long userId, String username) {
        try {
            ReactionResponse response = ReactionResponse.builder()
                    .id(reactionId)
                    .emoji(emoji)
                    .userId(userId)
                    .username(username)
                    .messageId(messageId)
                    .createdAt(java.time.LocalDateTime.now())
                    .build();
            
            String topic = "add".equals(action) ? "/topic/reactions" : "/topic/reactions/remove";
            String channelTopic = "add".equals(action) 
                    ? "/topic/channels/" + channelId + "/reactions" 
                    : "/topic/channels/" + channelId + "/reactions/remove";
            
            if (channelId != null) {
                messagingTemplate.convertAndSend(channelTopic, response);
            }
            messagingTemplate.convertAndSend(topic, response);
            
            log.debug("Immediately broadcast reaction {}: reactionId={}, messageId={}", action, reactionId, messageId);
        } catch (Exception e) {
            log.warn("Failed to immediately broadcast reaction {}: {}", reactionId, e.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public List<MessageResponse> getAllMessages() {
        return messageRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::mapToMessageResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    @Cacheable(cacheNames = "channelMessages", key = "'channel:' + #channelId")
    public List<MessageResponse> getMessagesByChannelId(Long channelId) {
        return messageRepository.findByChannelIdOrderByCreatedAtDesc(channelId).stream()
                .map(this::mapToMessageResponse)
                .collect(Collectors.toList());
    }

    /**
     * Cursor-based pagination for infinite scroll.
     * Fetches messages older than the given message ID.
     * 
     * @param channelId the channel to fetch messages from
     * @param beforeId fetch messages with ID less than this (null for initial load = newest messages)
     * @param size number of messages to fetch
     * @return messages ordered oldest to newest (for chat display)
     */
    @Transactional(readOnly = true)
    @Cacheable(cacheNames = "channelMessagesCursor", key = "'channel:' + #channelId + ':before:' + #beforeId + ':size:' + #size", condition = "#beforeId != null")
    public List<MessageResponse> getMessagesByChannelIdCursor(Long channelId, Long beforeId, int size) {
        List<Message> messages;
        
        if (beforeId == null) {
            Pageable pageable = PageRequest.of(0, size, Sort.by(Sort.Direction.DESC, "id"));
            Page<Message> messagePage = messageRepository.findByChannelIdOrderByCreatedAtDesc(channelId, pageable);
            messages = messagePage.getContent();
        } else {
            Pageable pageable = PageRequest.of(0, size);
            messages = messageRepository.findByChannelIdAndIdLessThanOrderByIdDesc(channelId, beforeId, pageable);
        }
        
        List<MessageResponse> result = messages.stream()
                .map(this::mapToMessageResponse)
                .collect(Collectors.toList());

        java.util.Collections.reverse(result);
        return result;
    }

    @Transactional(readOnly = true)
    @Cacheable(cacheNames = "message", key = "'id:' + #id")
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
    @CacheEvict(cacheNames = "message", key = "'id:' + #id", beforeInvocation = false)
    public MessageResponse updateMessage(Long id, String content) {
        Message message = messageRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Message not found with id: " + id));

        // Cannot edit deleted messages
        if (message.isDeleted()) {
            throw new ResponseStatusException(HttpStatus.GONE, "Cannot edit a deleted message");
        }

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
    @CacheEvict(cacheNames = "message", key = "'id:' + #id", beforeInvocation = false)
    public void deleteMessage(Long id) {
        Message message = messageRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Message not found with id: " + id));

        // Already deleted - idempotent operation
        if (message.isDeleted()) {
            return;
        }

        User currentUser = currentUserService.getCurrentUserOrThrow();

        boolean isOwner = message.getUser().getId().equals(currentUser.getId());
        boolean isPrivileged = currentUser.getRole() == com.lootchat.LootChat.entity.Role.ADMIN || currentUser.getRole() == com.lootchat.LootChat.entity.Role.MODERATOR;
        if (!isOwner && !isPrivileged) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot delete this message");
        }

        // Delete reactions for this message
        reactionRepository.deleteByMessageId(id);

        // Delete image from S3 if present
        if (message.getImageFilename() != null) {
            s3FileStorageService.deleteFile(message.getImageFilename());
        }

        // Soft delete: mark as deleted and clear content
        // This preserves reply chain integrity while hiding message content
        message.setDeleted(true);
        message.setDeletedAt(java.time.LocalDateTime.now());
        message.setContent(""); // Clear original content for privacy
        message.setImageUrl(null);
        message.setImageFilename(null);
        messageRepository.save(message);

        Long channelId = message.getChannel() != null ? message.getChannel().getId() : null;
        publishMessageDeleteToKafka(id, channelId);
    }

    private MessageResponse mapToMessageResponse(Message message) {
        // For deleted messages, return minimal info with placeholder content
        if (message.isDeleted()) {
            return MessageResponse.builder()
                    .id(message.getId())
                    .content("[Message deleted]")
                    .userId(message.getUser().getId())
                    .username(message.getUser().getUsername())
                    .avatar(null) // Hide avatar for deleted messages
                    .imageUrl(null)
                    .imageFilename(null)
                    .channelId(message.getChannel() != null ? message.getChannel().getId() : null)
                    .channelName(message.getChannel() != null ? message.getChannel().getName() : null)
                    .createdAt(message.getCreatedAt())
                    .updatedAt(message.getUpdatedAt())
                    .reactions(new ArrayList<>()) // No reactions for deleted messages
                    .replyToMessageId(message.getReplyToMessage() != null ? message.getReplyToMessage().getId() : null)
                    .replyToUsername(message.getReplyToUsername())
                    .replyToContent(message.getReplyToContent())
                    .deleted(true)
                    .build();
        }

        List<ReactionResponse> reactions = reactionRepository.findByMessageId(message.getId())
                .stream()
                .map(this::mapToReactionResponse)
                .collect(Collectors.toList());

        // Check if this message replies to a deleted message
        String replyToContent = message.getReplyToContent();
        if (message.getReplyToMessage() != null && message.getReplyToMessage().isDeleted()) {
            replyToContent = "[Message deleted]";
        }

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
                .replyToMessageId(message.getReplyToMessage() != null ? message.getReplyToMessage().getId() : null)
                .replyToUsername(message.getReplyToUsername())
                .replyToContent(replyToContent)
                .deleted(false)
                .build();
    }

    @Transactional
    @CacheEvict(cacheNames = "message", key = "'id:' + #messageId", beforeInvocation = false)
    public ReactionResponse addReaction(Long messageId, String emoji) {
        Long userId = currentUserService.getCurrentUserIdOrThrow();
        
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Message not found with id: " + messageId));

        // Cannot react to deleted messages
        if (message.isDeleted()) {
            throw new ResponseStatusException(HttpStatus.GONE, "Cannot add reaction to a deleted message");
        }

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
    @CacheEvict(cacheNames = "message", key = "'id:' + #messageId", beforeInvocation = false)
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
    
    private void evictChannelFirstPageCache(Long channelId) {
        var cache = cacheManager.getCache("channelMessagesPaginated");
        if (cache != null) {
            cache.evict("channel:" + channelId + ":page:0:size:30");
        }
    }
}
