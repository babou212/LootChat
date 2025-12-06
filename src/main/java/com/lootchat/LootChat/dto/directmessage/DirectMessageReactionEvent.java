package com.lootchat.LootChat.dto.directmessage;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DirectMessageReactionEvent {
    private Long reactionId;
    private Long messageId;
    private Long directMessageId;
    private String action; 
    private String emoji;
    private Long userId;
    private String username;
    private Long user1Id;
    private Long user2Id;
}
