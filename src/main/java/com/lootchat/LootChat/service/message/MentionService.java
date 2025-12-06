package com.lootchat.LootChat.service.message;

import com.lootchat.LootChat.dto.message.MentionNotificationEvent;
import com.lootchat.LootChat.entity.Message;
import com.lootchat.LootChat.entity.User;
import com.lootchat.LootChat.repository.UserRepository;
import com.lootchat.LootChat.service.user.UserPresenceService;
import com.lootchat.LootChat.service.common.WebSocketBroadcastService;
import com.lootchat.LootChat.service.inbox.OutboxService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Service for parsing and handling @mentions in messages.
 * 
 * Supports:
 * - @everyone - notifies all users
 * - @here - notifies all online users (uses presence)
 * - @username - notifies a specific user
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MentionService {
    
    private final UserRepository userRepository;
    private final UserPresenceService userPresenceService;
    private final WebSocketBroadcastService broadcastService;
    private final OutboxService outboxService;
    
    // Pattern to match @mentions: @everyone, @here, or @username (alphanumeric + underscore)
    private static final Pattern MENTION_PATTERN = Pattern.compile("@(everyone|here|[a-zA-Z0-9_]+)");
    
    // Topic constant for mention notifications
    public static final String TOPIC_MENTIONS = "lootchat.mentions";
    public static final String EVENT_MENTION = "MENTION";
    
    /**
     * Parse mentions from message content.
     * 
     * @param content The message content
     * @return Set of mention strings (without @)
     */
    public Set<String> parseMentions(String content) {
        if (content == null || content.isEmpty()) {
            return Set.of();
        }
        
        Set<String> mentions = new HashSet<>();
        Matcher matcher = MENTION_PATTERN.matcher(content);
        
        while (matcher.find()) {
            mentions.add(matcher.group(1).toLowerCase());
        }
        
        return mentions;
    }
    
    /**
     * Process mentions in a message and send notifications.
     * 
     * @param message The saved message
     */
    @Transactional
    public void processMentions(Message message) {
        Set<String> mentions = parseMentions(message.getContent());
        
        if (mentions.isEmpty()) {
            return;
        }
        
        Long senderId = message.getUser().getId();
        Set<Long> mentionedUserIds = new HashSet<>();
        String mentionType = "user";
        
        if (mentions.contains("everyone")) {
            mentionType = "everyone";
            List<User> allUsers = userRepository.findAll();
            mentionedUserIds = allUsers.stream()
                    .map(User::getId)
                    .filter(id -> !id.equals(senderId)) // Don't notify sender
                    .collect(Collectors.toSet());
            log.debug("@everyone mention - notifying {} users", mentionedUserIds.size());
        }

        else if (mentions.contains("here")) {
            mentionType = "here";
            Set<String> onlineUsernames = userPresenceService.getOnlineUsers();
            for (String username : onlineUsernames) {
                User user = userRepository.findByUsername(username);
                if (user != null && !user.getId().equals(senderId)) {
                    mentionedUserIds.add(user.getId());
                }
            }
            log.debug("@here mention - notifying {} online users", mentionedUserIds.size());
        }
        
        for (String mention : mentions) {
            if (!mention.equals("everyone") && !mention.equals("here")) {
                User mentionedUser = userRepository.findByUsername(mention);
                if (mentionedUser != null && !mentionedUser.getId().equals(senderId)) {
                    mentionedUserIds.add(mentionedUser.getId());
                    log.debug("@{} mention - adding user {} to notifications", mention, mentionedUser.getId());
                }
            }
        }
        
        if (mentionedUserIds.isEmpty()) {
            return;
        }
        
        String messagePreview = message.getContent();
        if (messagePreview.length() > 100) {
            messagePreview = messagePreview.substring(0, 100) + "...";
        }
        
        MentionNotificationEvent event = MentionNotificationEvent.builder()
                .messageId(message.getId())
                .channelId(message.getChannel() != null ? message.getChannel().getId() : null)
                .channelName(message.getChannel() != null ? message.getChannel().getName() : null)
                .senderId(senderId)
                .senderUsername(message.getUser().getUsername())
                .senderAvatar(message.getUser().getAvatar())
                .messagePreview(messagePreview)
                .mentionType(mentionType)
                .targetUserIds(new ArrayList<>(mentionedUserIds))
                .build();
        
        for (Long userId : mentionedUserIds) {
            try {
                broadcastService.broadcastToUser(userId, "/mentions", event);
                log.debug("Sent mention notification to user {}", userId);
            } catch (Exception e) {
                log.warn("Failed to send mention notification to user {}: {}", userId, e.getMessage());
            }
        }
        
        outboxService.saveEvent(
                EVENT_MENTION,
                TOPIC_MENTIONS,
                message.getChannel() != null ? message.getChannel().getId().toString() : "global",
                event
        );
    }
    
    /**
     * Get list of all usernames for autocomplete.
     * 
     * @return List of usernames
     */
    public List<String> getAllUsernames() {
        return userRepository.findAll().stream()
                .map(User::getUsername)
                .sorted()
                .collect(Collectors.toList());
    }
    
    /**
     * Search usernames by prefix for autocomplete.
     * 
     * @param prefix The prefix to search for
     * @return List of matching usernames
     */
    public List<String> searchUsernames(String prefix) {
        if (prefix == null || prefix.isEmpty()) {
            return getAllUsernames();
        }
        
        String lowerPrefix = prefix.toLowerCase();
        return userRepository.findAll().stream()
                .map(User::getUsername)
                .filter(username -> username.toLowerCase().startsWith(lowerPrefix))
                .sorted()
                .limit(10)
                .collect(Collectors.toList());
    }
}
