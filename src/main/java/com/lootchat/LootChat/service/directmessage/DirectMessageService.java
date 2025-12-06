package com.lootchat.LootChat.service.directmessage;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lootchat.LootChat.dto.directmessage.*;
import com.lootchat.LootChat.dto.user.UserResponse;
import com.lootchat.LootChat.entity.DirectMessage;
import com.lootchat.LootChat.entity.DirectMessageMessage;
import com.lootchat.LootChat.entity.DirectMessageReaction;
import com.lootchat.LootChat.entity.Role;
import com.lootchat.LootChat.entity.User;
import com.lootchat.LootChat.repository.DirectMessageMessageRepository;
import com.lootchat.LootChat.repository.DirectMessageReactionRepository;
import com.lootchat.LootChat.repository.DirectMessageRepository;
import com.lootchat.LootChat.repository.UserRepository;
import com.lootchat.LootChat.security.CurrentUserService;
import com.lootchat.LootChat.service.common.WebSocketBroadcastService;
import com.lootchat.LootChat.service.file.S3FileStorageService;
import com.lootchat.LootChat.service.inbox.OutboxService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class DirectMessageService {
    
    private final DirectMessageRepository directMessageRepository;
    private final DirectMessageMessageRepository directMessageMessageRepository;
    private final DirectMessageReactionRepository directMessageReactionRepository;
    private final UserRepository userRepository;
    private final CurrentUserService currentUserService;
    private final OutboxService outboxService;
    private final ObjectMapper objectMapper;
    private final S3FileStorageService s3FileStorageService;
    private final CacheManager cacheManager;
    private final WebSocketBroadcastService broadcastService;
    
    @Transactional(readOnly = true)
    public List<DirectMessageResponse> getAllDirectMessages() {
        Long currentUserId = currentUserService.getCurrentUserIdOrThrow();
        return getAllDirectMessagesForUser(currentUserId);
    }
    
    @Cacheable(cacheNames = "directMessages", key = "'user:' + #userId")
    public List<DirectMessageResponse> getAllDirectMessagesForUser(Long userId) {
        Long currentUserId = userId;
        List<DirectMessage> directMessages = directMessageRepository.findAllByUser(currentUserId);
        
        return directMessages.stream()
                .map(dm -> mapToDirectMessageResponse(dm, currentUserId))
                .collect(Collectors.toList());
    }
    
    @Transactional
    public DirectMessageResponse createOrGetDirectMessage(Long recipientId) {
        Long currentUserId = currentUserService.getCurrentUserIdOrThrow();
        
        if (currentUserId.equals(recipientId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot create direct message with yourself");
        }
        
        var existingDm = directMessageRepository.findByBothUsers(currentUserId, recipientId);
        if (existingDm.isPresent()) {
            return mapToDirectMessageResponse(existingDm.get(), currentUserId);
        }
        
        User currentUser = userRepository.findById(currentUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Current user not found"));
        User recipient = userRepository.findById(recipientId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Recipient not found"));
        
        DirectMessage newDm = DirectMessage.builder()
                .user1(currentUser)
                .user2(recipient)
                .messages(new ArrayList<>())
                .build();
        
        DirectMessage savedDm = directMessageRepository.save(newDm);
        return mapToDirectMessageResponse(savedDm, currentUserId);
    }
    
    @Transactional(readOnly = true)
    @Cacheable(cacheNames = "dmMessagesPaginated", key = "'dm:' + #directMessageId + ':page:' + #page + ':size:' + #size")
    public List<DirectMessageMessageResponse> getDirectMessages(Long directMessageId, int page, int size) {
        Long currentUserId = currentUserService.getCurrentUserIdOrThrow();
        
        DirectMessage dm = directMessageRepository.findById(directMessageId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Direct message not found"));
        

        if (!dm.includesUser(currentUserId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }
        
        List<DirectMessageMessage> messages = directMessageMessageRepository
                .findByDirectMessageId(directMessageId, PageRequest.of(page, size));
        
        return messages.stream()
                .map(this::mapToDirectMessageMessageResponse)
                .collect(Collectors.toList());
    }
    
    @Transactional
    public DirectMessageMessageResponse sendMessage(SendDirectMessageRequest request) {
        Long currentUserId = currentUserService.getCurrentUserIdOrThrow();
        
        DirectMessage dm = directMessageRepository.findByIdWithUsers(request.getDirectMessageId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Direct message not found"));
        
        if (!dm.includesUser(currentUserId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }
        
        User sender = userRepository.findById(currentUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        
        DirectMessageMessage.DirectMessageMessageBuilder messageBuilder = DirectMessageMessage.builder()
                .content(request.getContent())
                .sender(sender)
                .directMessage(dm)
                .isRead(false);
        
        if (request.getImageUrl() != null) {
            messageBuilder.imageUrl(request.getImageUrl())
                    .imageFilename(request.getImageFilename());
        }
        
        if (request.getReplyToMessageId() != null) {
            DirectMessageMessage replyToMessage = directMessageMessageRepository.findById(request.getReplyToMessageId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reply message not found"));
            messageBuilder.replyToMessage(replyToMessage)
                    .replyToUsername(request.getReplyToUsername())
                    .replyToContent(request.getReplyToContent());
        }
        
        DirectMessageMessage message = messageBuilder.build();
        DirectMessageMessage savedMessage = directMessageMessageRepository.save(message);
        
        dm.setLastMessageAt(LocalDateTime.now());
        directMessageRepository.save(dm);
        
        evictFirstPageCache(dm.getId());

        evictDirectMessagesListCache(dm.getUser1().getId(), dm.getUser2().getId());
        
        publishMessageToKafka(savedMessage.getId(), dm.getId(), currentUserId, 
                dm.getOtherUser(currentUserId).getId(), request.getContent());
        
        return mapToDirectMessageMessageResponse(savedMessage);
    }
    
    @Transactional
    public DirectMessageMessageResponse sendMessageWithImage(
            String content, 
            Long directMessageId, 
            MultipartFile image, 
            Long replyToMessageId,
            String replyToUsername,
            String replyToContent) {
        Long currentUserId = currentUserService.getCurrentUserIdOrThrow();
        
        DirectMessage dm = directMessageRepository.findByIdWithUsers(directMessageId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Direct message not found"));
        
        if (!dm.includesUser(currentUserId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }
        
        User sender = userRepository.findById(currentUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        
        String imageFilename = s3FileStorageService.storeFile(image);
        String imageUrl = "/api/files/images/" + imageFilename;
        
        String messageContent = content != null ? content : "";
        
        DirectMessageMessage.DirectMessageMessageBuilder messageBuilder = DirectMessageMessage.builder()
                .content(messageContent)
                .sender(sender)
                .directMessage(dm)
                .imageUrl(imageUrl)
                .imageFilename(imageFilename)
                .isRead(false);
        
        if (replyToMessageId != null) {
            DirectMessageMessage replyToMessage = directMessageMessageRepository.findById(replyToMessageId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reply message not found"));
            messageBuilder.replyToMessage(replyToMessage)
                    .replyToUsername(replyToUsername)
                    .replyToContent(replyToContent);
        }
        
        DirectMessageMessage message = messageBuilder.build();
        DirectMessageMessage savedMessage = directMessageMessageRepository.save(message);
        
        dm.setLastMessageAt(LocalDateTime.now());
        directMessageRepository.save(dm);
        
        evictFirstPageCache(dm.getId());
        evictDirectMessagesListCache(dm.getUser1().getId(), dm.getUser2().getId());
        
        publishMessageToKafka(savedMessage.getId(), dm.getId(), currentUserId, 
                dm.getOtherUser(currentUserId).getId(), messageContent);
        
        return mapToDirectMessageMessageResponse(savedMessage);
    }
    
    @Transactional
    public void markAsRead(Long directMessageId) {
        Long currentUserId = currentUserService.getCurrentUserIdOrThrow();
        
        DirectMessage dm = directMessageRepository.findById(directMessageId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Direct message not found"));
        
        if (!dm.includesUser(currentUserId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }
        
        List<DirectMessageMessage> messages = directMessageMessageRepository
                .findByDirectMessageId(directMessageId, PageRequest.of(0, Integer.MAX_VALUE));
        
        messages.stream()
                .filter(msg -> !msg.getSender().getId().equals(currentUserId) && !msg.isRead())
                .forEach(msg -> msg.setRead(true));
        
        directMessageMessageRepository.saveAll(messages);
    }
    
    private DirectMessageResponse mapToDirectMessageResponse(DirectMessage dm, Long currentUserId) {
        User otherUser = dm.getOtherUser(currentUserId);
        
        var lastMessage = directMessageMessageRepository.findLastMessageByDirectMessageId(dm.getId());
        String lastMessageContent = lastMessage.map(DirectMessageMessage::getContent).orElse(null);
        
        int unreadCount = directMessageMessageRepository.countUnreadMessages(dm.getId(), currentUserId);
        
        return DirectMessageResponse.builder()
                .id(dm.getId())
                .otherUserId(otherUser.getId())
                .otherUsername(otherUser.getUsername())
                .otherUserAvatar(otherUser.getAvatar())
                .lastMessageContent(lastMessageContent)
                .lastMessageAt(dm.getLastMessageAt())
                .unreadCount(unreadCount)
                .createdAt(dm.getCreatedAt())
                .build();
    }
    
    @Transactional
    public DirectMessageReactionResponse addReaction(Long messageId, String emoji) {
        Long currentUserId = currentUserService.getCurrentUserIdOrThrow();
        
        DirectMessageMessage message = directMessageMessageRepository.findById(messageId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Message not found"));

        // Cannot react to deleted messages
        if (message.isDeleted()) {
            throw new ResponseStatusException(HttpStatus.GONE, "Cannot add reaction to a deleted message");
        }
        
        if (!message.getDirectMessage().includesUser(currentUserId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }
        
        User user = userRepository.findById(currentUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        
        // Check if reaction already exists
        var existingReaction = directMessageReactionRepository
                .findByMessageIdAndUserIdAndEmoji(messageId, currentUserId, emoji);
        if (existingReaction.isPresent()) {
            return mapToDirectMessageReactionResponse(existingReaction.get());
        }
        
        DirectMessageReaction reaction = DirectMessageReaction.builder()
                .emoji(emoji)
                .userId(currentUserId)
                .username(user.getUsername())
                .message(message)
                .build();
        
        DirectMessageReaction savedReaction = directMessageReactionRepository.save(reaction);
        
        DirectMessage dm = message.getDirectMessage();
        
        publishReactionToKafka(savedReaction.getId(), messageId, dm.getId(),
                "add", emoji, currentUserId, user.getUsername(),
                dm.getUser1().getId(), dm.getUser2().getId());
        
        return mapToDirectMessageReactionResponse(savedReaction);
    }
    
    @Transactional
    public void removeReaction(Long messageId, String emoji) {
        Long currentUserId = currentUserService.getCurrentUserIdOrThrow();
        
        DirectMessageMessage message = directMessageMessageRepository.findById(messageId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Message not found"));
        
        if (!message.getDirectMessage().includesUser(currentUserId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }
        
        var reaction = directMessageReactionRepository
                .findByMessageIdAndUserIdAndEmoji(messageId, currentUserId, emoji)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reaction not found"));
        
        Long reactionId = reaction.getId();
        DirectMessage dm = message.getDirectMessage();
        Long directMessageId = dm.getId();
        String username = reaction.getUsername();
        
        directMessageReactionRepository.delete(reaction);
        
        publishReactionToKafka(reactionId, messageId, directMessageId,
                "remove", emoji, currentUserId, username,
                dm.getUser1().getId(), dm.getUser2().getId());
    }
    
    @Transactional
    public DirectMessageMessageResponse updateMessage(Long messageId, String content) {
        Long currentUserId = currentUserService.getCurrentUserIdOrThrow();
        
        DirectMessageMessage message = directMessageMessageRepository.findById(messageId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Message not found"));
        
        // Cannot edit deleted messages
        if (message.isDeleted()) {
            throw new ResponseStatusException(HttpStatus.GONE, "Cannot edit a deleted message");
        }
        
        if (!message.getSender().getId().equals(currentUserId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Can only edit your own messages");
        }
        
        message.setContent(content);
        message.setEdited(true);
        DirectMessageMessage updatedMessage = directMessageMessageRepository.save(message);
        
        publishEditToKafka(messageId, message.getDirectMessage().getId(), content, true);
        
        return mapToDirectMessageMessageResponse(updatedMessage);
    }
    
    @Transactional
    public void deleteMessage(Long messageId) {
        Long currentUserId = currentUserService.getCurrentUserIdOrThrow();
        
        DirectMessageMessage message = directMessageMessageRepository.findById(messageId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Message not found"));
        
        // Already deleted - idempotent operation
        if (message.isDeleted()) {
            return;
        }
        
        User user = userRepository.findById(currentUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        
        boolean isOwner = message.getSender().getId().equals(currentUserId);
        boolean isPrivileged = user.getRole() == Role.ADMIN || user.getRole() == Role.MODERATOR;
        
        if (!isOwner && !isPrivileged) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }
        
        // Delete reactions for this message
        directMessageReactionRepository.deleteByMessageId(messageId);
        
        // Delete image from S3 if present
        if (message.getImageFilename() != null) {
            s3FileStorageService.deleteFile(message.getImageFilename());
        }
        
        Long directMessageId = message.getDirectMessage().getId();
        DirectMessage dm = message.getDirectMessage();

        // Soft delete: mark as deleted and clear content
        // This preserves reply chain integrity while hiding message content
        message.setDeleted(true);
        message.setDeletedAt(LocalDateTime.now());
        message.setContent(""); // Clear original content for privacy
        message.setImageUrl(null);
        message.setImageFilename(null);
        directMessageMessageRepository.save(message);

        evictDirectMessagesListCache(dm.getUser1().getId(), dm.getUser2().getId());
        
        publishDeleteToKafka(messageId, directMessageId);
    }
    
    private DirectMessageMessageResponse mapToDirectMessageMessageResponse(DirectMessageMessage message) {
        // For deleted messages, return minimal info with placeholder content
        if (message.isDeleted()) {
            return DirectMessageMessageResponse.builder()
                    .id(message.getId())
                    .content("[Message deleted]")
                    .senderId(message.getSender().getId())
                    .senderUsername(message.getSender().getUsername())
                    .senderAvatar(null) // Hide avatar for deleted messages
                    .directMessageId(message.getDirectMessage().getId())
                    .imageUrl(null)
                    .imageFilename(null)
                    .replyToMessageId(message.getReplyToMessage() != null ? message.getReplyToMessage().getId() : null)
                    .replyToUsername(message.getReplyToUsername())
                    .replyToContent(message.getReplyToContent())
                    .isRead(message.isRead())
                    .edited(message.isEdited())
                    .deleted(true)
                    .createdAt(message.getCreatedAt())
                    .updatedAt(message.getUpdatedAt())
                    .reactions(new ArrayList<>()) // No reactions for deleted messages
                    .build();
        }

        List<DirectMessageReaction> reactions = directMessageReactionRepository.findByMessageId(message.getId());
        List<DirectMessageReactionResponse> reactionResponses = reactions.stream()
                .map(this::mapToDirectMessageReactionResponse)
                .collect(Collectors.toList());

        // Check if this message replies to a deleted message
        String replyToContent = message.getReplyToContent();
        if (message.getReplyToMessage() != null && message.getReplyToMessage().isDeleted()) {
            replyToContent = "[Message deleted]";
        }
        
        return DirectMessageMessageResponse.builder()
                .id(message.getId())
                .content(message.getContent())
                .senderId(message.getSender().getId())
                .senderUsername(message.getSender().getUsername())
                .senderAvatar(message.getSender().getAvatar())
                .directMessageId(message.getDirectMessage().getId())
                .imageUrl(message.getImageUrl())
                .imageFilename(message.getImageFilename())
                .replyToMessageId(message.getReplyToMessage() != null ? message.getReplyToMessage().getId() : null)
                .replyToUsername(message.getReplyToUsername())
                .replyToContent(replyToContent)
                .isRead(message.isRead())
                .edited(message.isEdited())
                .deleted(false)
                .createdAt(message.getCreatedAt())
                .updatedAt(message.getUpdatedAt())
                .reactions(reactionResponses)
                .build();
    }
    
    private DirectMessageReactionResponse mapToDirectMessageReactionResponse(DirectMessageReaction reaction) {
        return DirectMessageReactionResponse.builder()
                .id(reaction.getId())
                .emoji(reaction.getEmoji())
                .userId(reaction.getUserId())
                .username(reaction.getUsername())
                .messageId(reaction.getMessage().getId())
                .createdAt(reaction.getCreatedAt())
                .build();
    }
    
    /**
     * Publish message event via outbox pattern for reliable delivery.
     * This is called within the same @Transactional context as message save,
     * ensuring atomicity between DB write and event creation.
     */
    private void publishMessageToKafka(Long messageId, Long directMessageId, Long senderId, 
                                      Long recipientId, String content) {
        // Broadcast immediately via WebSocket for real-time updates
        broadcastDirectMessageImmediately(messageId, directMessageId, senderId, recipientId, content);
        
        // Also save to outbox for multi-pod consistency
        DirectMessageEvent event = new DirectMessageEvent(messageId, directMessageId, senderId, recipientId, content);
        outboxService.saveEvent(
                OutboxService.EVENT_MESSAGE_CREATED,
                OutboxService.TOPIC_DIRECT_MESSAGES,
                String.valueOf(directMessageId),
                event
        );
    }
    
    /**
     * Publish reaction event via outbox pattern.
     */
    private void publishReactionToKafka(Long reactionId, Long messageId, Long directMessageId,
                                       String action, String emoji, Long userId, String username,
                                       Long user1Id, Long user2Id) {
        // Broadcast immediately via WebSocket for real-time updates
        broadcastDirectMessageReactionImmediately(reactionId, messageId, directMessageId, 
                action, emoji, userId, username, user1Id, user2Id);
        
        // Also save to outbox for multi-pod consistency
        DirectMessageReactionEvent event = new DirectMessageReactionEvent(
                reactionId, messageId, directMessageId, action, emoji, userId, username, user1Id, user2Id);
        String eventType = "add".equals(action) ? OutboxService.EVENT_REACTION_ADDED : OutboxService.EVENT_REACTION_REMOVED;
        outboxService.saveEvent(
                eventType,
                OutboxService.TOPIC_DIRECT_REACTIONS,
                String.valueOf(directMessageId),
                event
        );
    }
    
    /**
     * Publish edit event via outbox pattern.
     */
    private void publishEditToKafka(Long messageId, Long directMessageId, String content, Boolean edited) {
        // Broadcast immediately via WebSocket for real-time updates
        broadcastDirectMessageEditImmediately(messageId, directMessageId, content, edited);
        
        // Also save to outbox for multi-pod consistency
        DirectMessageEditEvent event = new DirectMessageEditEvent(messageId, directMessageId, content, edited);
        outboxService.saveEvent(
                OutboxService.EVENT_MESSAGE_EDITED,
                OutboxService.TOPIC_DIRECT_EDITS,
                String.valueOf(directMessageId),
                event
        );
    }
    
    /**
     * Publish delete event via outbox pattern.
     */
    private void publishDeleteToKafka(Long messageId, Long directMessageId) {
        // Broadcast immediately via WebSocket for real-time updates
        broadcastDirectMessageDeleteImmediately(messageId, directMessageId);
        
        // Also save to outbox for multi-pod consistency
        DirectMessageDeleteEvent event = new DirectMessageDeleteEvent(messageId, directMessageId);
        outboxService.saveEvent(
                OutboxService.EVENT_MESSAGE_DELETED,
                OutboxService.TOPIC_DIRECT_DELETIONS,
                String.valueOf(directMessageId),
                event
        );
    }
    
    private void evictFirstPageCache(Long directMessageId) {
        Cache cache = cacheManager.getCache("dmMessagesPaginated");
        if (cache != null) {
            cache.evict("dm:" + directMessageId + ":page:0:size:50");
            cache.evict("dm:" + directMessageId + ":page:0:size:30");
            cache.evict("dm:" + directMessageId + ":page:0:size:20");
        }
    }
    
    private void evictDirectMessagesListCache(Long user1Id, Long user2Id) {
        Cache cache = cacheManager.getCache("directMessages");
        if (cache != null) {
            cache.evict("user:" + user1Id);
            cache.evict("user:" + user2Id);
        }
    }
    
    // ============ Immediate WebSocket Broadcasting Methods ============
    // These provide instant real-time updates while the outbox pattern ensures multi-pod consistency
    
    /**
     * Broadcasts a new direct message immediately via WebSocket.
     */
    private void broadcastDirectMessageImmediately(Long messageId, Long directMessageId, 
                                                   Long senderId, Long recipientId, String content) {
        try {
            Map<String, Object> payload = Map.of(
                "type", "new_message",
                "messageId", messageId,
                "directMessageId", directMessageId,
                "senderId", senderId,
                "content", content
            );
            
            // Send to both participants of the DM conversation via Redis for cross-pod sync
            broadcastService.broadcast("/topic/dm/" + senderId, payload);
            broadcastService.broadcast("/topic/dm/" + recipientId, payload);
            log.debug("Broadcasted DM immediately to users {} and {}", senderId, recipientId);
        } catch (Exception e) {
            log.error("Error broadcasting direct message immediately: {}", e.getMessage(), e);
        }
    }
    
    /**
     * Broadcasts a direct message edit immediately via WebSocket.
     */
    private void broadcastDirectMessageEditImmediately(Long messageId, Long directMessageId, 
                                                       String content, Boolean edited) {
        try {
            DirectMessage dm = directMessageRepository.findById(directMessageId).orElse(null);
            if (dm == null) {
                log.warn("Could not broadcast DM edit - DM not found: {}", directMessageId);
                return;
            }
            
            Map<String, Object> payload = Map.of(
                "type", "message_updated",
                "messageId", messageId,
                "directMessageId", directMessageId,
                "content", content,
                "edited", edited != null ? edited : false
            );
            
            broadcastService.broadcast("/topic/dm/" + dm.getUser1().getId(), payload);
            broadcastService.broadcast("/topic/dm/" + dm.getUser2().getId(), payload);
            log.debug("Broadcasted DM edit immediately to users {} and {}", 
                    dm.getUser1().getId(), dm.getUser2().getId());
        } catch (Exception e) {
            log.error("Error broadcasting direct message edit immediately: {}", e.getMessage(), e);
        }
    }
    
    /**
     * Broadcasts a direct message delete immediately via WebSocket.
     */
    private void broadcastDirectMessageDeleteImmediately(Long messageId, Long directMessageId) {
        try {
            DirectMessage dm = directMessageRepository.findById(directMessageId).orElse(null);
            if (dm == null) {
                log.warn("Could not broadcast DM delete - DM not found: {}", directMessageId);
                return;
            }
            
            Map<String, Object> payload = Map.of(
                "type", "message_deleted",
                "messageId", messageId,
                "directMessageId", directMessageId
            );
            
            broadcastService.broadcast("/topic/dm/" + dm.getUser1().getId(), payload);
            broadcastService.broadcast("/topic/dm/" + dm.getUser2().getId(), payload);
            log.debug("Broadcasted DM delete immediately to users {} and {}", 
                    dm.getUser1().getId(), dm.getUser2().getId());
        } catch (Exception e) {
            log.error("Error broadcasting direct message delete immediately: {}", e.getMessage(), e);
        }
    }
    
    /**
     * Broadcasts a reaction update immediately via WebSocket.
     */
    private void broadcastDirectMessageReactionImmediately(Long reactionId, Long messageId, 
                                                           Long directMessageId, String action,
                                                           String emoji, Long userId, String username,
                                                           Long user1Id, Long user2Id) {
        try {
            Map<String, Object> payload = Map.of(
                "type", "add".equals(action) ? "reaction_added" : "reaction_removed",
                "reactionId", reactionId != null ? reactionId : 0,
                "messageId", messageId,
                "directMessageId", directMessageId,
                "emoji", emoji,
                "userId", userId,
                "username", username
            );
            
            broadcastService.broadcast("/topic/dm/" + user1Id, payload);
            broadcastService.broadcast("/topic/dm/" + user2Id, payload);
            log.debug("Broadcasted DM reaction immediately to users {} and {}", user1Id, user2Id);
        } catch (Exception e) {
            log.error("Error broadcasting direct message reaction immediately: {}", e.getMessage(), e);
        }
    }
}
