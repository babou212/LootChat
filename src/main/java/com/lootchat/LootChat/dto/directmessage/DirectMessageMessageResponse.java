package com.lootchat.LootChat.dto.directmessage;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DirectMessageMessageResponse {
    private Long id;
    private String content;
    private Long senderId;
    private String senderUsername;
    private String senderAvatar;
    private Long directMessageId;
    private String imageUrl;
    private String imageFilename;
    private Long replyToMessageId;
    private String replyToUsername;
    private String replyToContent;
    private boolean isRead;
    private boolean edited;
    private boolean deleted;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<DirectMessageReactionResponse> reactions;
}
