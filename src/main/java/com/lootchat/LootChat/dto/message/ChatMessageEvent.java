package com.lootchat.LootChat.dto.common;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChatMessageEvent {
    private Long messageId;
    private String content;
    private Long channelId;
    private Long userId;
    
    public ChatMessageEvent(String content, Long channelId, Long userId) {
        this.content = content;
        this.channelId = channelId;
        this.userId = userId;
    }
}
