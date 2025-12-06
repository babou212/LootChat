package com.lootchat.LootChat.dto.message;

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
public class MessageSearchResult {
    private Long messageId;
    private String content;
    private Long channelId;
    private String channelName;
    private Long userId;
    private String username;
    private String userAvatar;
    private LocalDateTime createdAt;
    private Boolean edited;
    private List<String> attachmentUrls;
}
