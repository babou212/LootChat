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
public class DirectMessageReactionResponse {
    private Long id;
    private String emoji;
    private Long userId;
    private String username;
    private Long messageId;
    private LocalDateTime createdAt;
}
