package com.lootchat.LootChat.dto.directmessage;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DirectMessageResponse {
    private Long id;
    private Long otherUserId;
    private String otherUsername;
    private String otherUserAvatar;
    private String lastMessageContent;
    private LocalDateTime lastMessageAt;
    private int unreadCount;
    private LocalDateTime createdAt;
}
