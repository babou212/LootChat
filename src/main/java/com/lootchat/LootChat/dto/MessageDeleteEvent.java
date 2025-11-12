package com.lootchat.LootChat.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MessageDeleteEvent {
    private Long messageId;
    private Long channelId;
}
