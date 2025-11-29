package com.lootchat.LootChat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MessageResponse {
    private Long id;
    private String content;
    private Long userId;
    private String username;
    private String avatar;
    private String imageUrl;
    private String imageFilename;
    private Long channelId;
    private String channelName;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    @Builder.Default
    private List<ReactionResponse> reactions = new ArrayList<>();
    private Long replyToMessageId;
    private String replyToUsername;
    private String replyToContent;
    private boolean deleted;
}
