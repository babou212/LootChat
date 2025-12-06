package com.lootchat.LootChat.dto.message;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MessageUpdateEvent {
    private Long messageId;
    private String content;
    private Long channelId;
}
