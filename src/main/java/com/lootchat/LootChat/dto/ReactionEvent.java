package com.lootchat.LootChat.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ReactionEvent {
    private Long reactionId;
    private Long messageId;
    private Long channelId;
    private String action; 
    private String emoji;
    private Long userId;
    private String username;
}
