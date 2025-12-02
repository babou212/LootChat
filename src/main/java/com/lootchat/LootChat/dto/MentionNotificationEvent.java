package com.lootchat.LootChat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Event sent when a user is mentioned in a message.
 * Used for browser notifications.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MentionNotificationEvent {
    private Long messageId;
    private Long channelId;
    private String channelName;
    private Long senderId;
    private String senderUsername;
    private String senderAvatar;
    private String messagePreview;
    private String mentionType; // "user", "everyone", "here"
    private List<Long> targetUserIds; // Users who should receive this notification
}
