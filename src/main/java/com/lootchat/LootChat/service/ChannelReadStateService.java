package com.lootchat.LootChat.service;

import com.lootchat.LootChat.dto.UnreadCountResponse;
import com.lootchat.LootChat.entity.Channel;
import com.lootchat.LootChat.entity.User;
import com.lootchat.LootChat.entity.UserChannelReadState;
import com.lootchat.LootChat.repository.ChannelRepository;
import com.lootchat.LootChat.repository.MessageRepository;
import com.lootchat.LootChat.repository.UserChannelReadStateRepository;
import com.lootchat.LootChat.repository.UserRepository;
import com.lootchat.LootChat.security.CurrentUserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service for managing user channel read states and calculating unread counts.
 * This enables persistent notification tracking for offline users.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ChannelReadStateService {

    private final UserChannelReadStateRepository readStateRepository;
    private final ChannelRepository channelRepository;
    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final CurrentUserService currentUserService;

    /**
     * Mark a channel as read for the current user.
     * Updates the lastReadAt timestamp to now and sets the lastReadMessageId.
     */
    @Transactional
    public void markChannelAsRead(Long channelId) {
        Long userId = currentUserService.getCurrentUserIdOrThrow();
        
        Channel channel = channelRepository.findById(channelId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Channel not found"));
        
        Optional<Long> latestMessageId = messageRepository.findLatestMessageIdInChannel(channelId);
        LocalDateTime now = LocalDateTime.now();
        
        Optional<UserChannelReadState> existingState = readStateRepository.findByUserIdAndChannelId(userId, channelId);
        
        if (existingState.isPresent()) {
            // Update existing record
            UserChannelReadState state = existingState.get();
            state.setLastReadAt(now);
            state.setLastReadMessageId(latestMessageId.orElse(null));
            readStateRepository.save(state);
        } else {
            // Create new record
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
            
            UserChannelReadState newState = UserChannelReadState.builder()
                    .user(user)
                    .channel(channel)
                    .lastReadAt(now)
                    .lastReadMessageId(latestMessageId.orElse(null))
                    .build();
            readStateRepository.save(newState);
        }
        
        log.debug("Marked channel {} as read for user {}", channelId, userId);
    }

    /**
     * Get unread counts for all channels for the current user.
     * Returns a map of channelId -> unreadCount.
     */
    @Transactional(readOnly = true)
    public Map<Long, Integer> getUnreadCountsForCurrentUser() {
        Long userId = currentUserService.getCurrentUserIdOrThrow();
        return getUnreadCountsForUser(userId);
    }

    /**
     * Get unread counts for all channels for a specific user.
     */
    @Transactional(readOnly = true)
    public Map<Long, Integer> getUnreadCountsForUser(Long userId) {
        // Get all channels
        List<Channel> allChannels = channelRepository.findAll();
        
        // Get user's read states
        List<UserChannelReadState> readStates = readStateRepository.findByUserId(userId);
        Map<Long, LocalDateTime> lastReadMap = readStates.stream()
                .collect(Collectors.toMap(
                        state -> state.getChannel().getId(),
                        UserChannelReadState::getLastReadAt
                ));
        
        Map<Long, Integer> unreadCounts = new HashMap<>();
        
        for (Channel channel : allChannels) {
            Long channelId = channel.getId();
            LocalDateTime lastReadAt = lastReadMap.get(channelId);
            
            int unreadCount;
            if (lastReadAt == null) {
                // User has never read this channel - count all messages
                // But to avoid overwhelming new users, we cap it at 99
                int totalMessages = messageRepository.countAllMessagesInChannel(channelId);
                unreadCount = Math.min(totalMessages, 99);
            } else {
                // Count messages after last read
                unreadCount = messageRepository.countUnreadMessagesInChannel(channelId, lastReadAt);
            }
            
            unreadCounts.put(channelId, unreadCount);
        }
        
        return unreadCounts;
    }

    /**
     * Get unread count for a specific channel for the current user.
     */
    @Transactional(readOnly = true)
    public int getUnreadCountForChannel(Long channelId) {
        Long userId = currentUserService.getCurrentUserIdOrThrow();
        
        Optional<UserChannelReadState> readState = readStateRepository.findByUserIdAndChannelId(userId, channelId);
        
        if (readState.isEmpty()) {
            // Never read - count all messages (capped)
            int totalMessages = messageRepository.countAllMessagesInChannel(channelId);
            return Math.min(totalMessages, 99);
        }
        
        return messageRepository.countUnreadMessagesInChannel(channelId, readState.get().getLastReadAt());
    }

    /**
     * Get unread counts as a list of UnreadCountResponse objects.
     */
    @Transactional(readOnly = true)
    public List<UnreadCountResponse> getUnreadCountsAsList() {
        Map<Long, Integer> counts = getUnreadCountsForCurrentUser();
        return counts.entrySet().stream()
                .map(entry -> UnreadCountResponse.builder()
                        .channelId(entry.getKey())
                        .unreadCount(entry.getValue())
                        .build())
                .collect(Collectors.toList());
    }

    /**
     * Initialize read states for a user for all existing channels.
     * Called when a user logs in for the first time or to sync states.
     */
    @Transactional
    public void initializeReadStatesForUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        
        List<Channel> allChannels = channelRepository.findAll();
        Set<Long> existingChannelIds = new HashSet<>(readStateRepository.findChannelIdsByUserId(userId));
        
        LocalDateTime now = LocalDateTime.now();
        
        for (Channel channel : allChannels) {
            if (!existingChannelIds.contains(channel.getId())) {
                // Create read state with current time (so user doesn't see old messages as unread)
                UserChannelReadState newState = UserChannelReadState.builder()
                        .user(user)
                        .channel(channel)
                        .lastReadAt(now)
                        .build();
                readStateRepository.save(newState);
            }
        }
        
        log.debug("Initialized read states for user {}", userId);
    }

    /**
     * Create read state for a new channel for all existing users.
     * Called when a new channel is created.
     */
    @Transactional
    public void initializeReadStatesForChannel(Long channelId) {
        Channel channel = channelRepository.findById(channelId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Channel not found"));
        
        List<User> allUsers = userRepository.findAll();
        LocalDateTime now = LocalDateTime.now();
        
        for (User user : allUsers) {
            Optional<UserChannelReadState> existing = readStateRepository.findByUserIdAndChannelId(user.getId(), channelId);
            if (existing.isEmpty()) {
                UserChannelReadState newState = UserChannelReadState.builder()
                        .user(user)
                        .channel(channel)
                        .lastReadAt(now)
                        .build();
                readStateRepository.save(newState);
            }
        }
        
        log.debug("Initialized read states for channel {}", channelId);
    }

    /**
     * Clean up read states when a channel is deleted.
     */
    @Transactional
    public void deleteReadStatesForChannel(Long channelId) {
        readStateRepository.deleteByChannelId(channelId);
        log.debug("Deleted read states for channel {}", channelId);
    }
}
