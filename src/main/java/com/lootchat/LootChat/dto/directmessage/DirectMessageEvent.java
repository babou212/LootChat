package com.lootchat.LootChat.dto.directmessage;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DirectMessageEvent {
    private Long messageId;
    private Long directMessageId;
    private Long senderId;
    private Long recipientId;
    private String content;
}
