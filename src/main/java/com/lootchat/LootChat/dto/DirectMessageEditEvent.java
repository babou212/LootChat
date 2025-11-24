package com.lootchat.LootChat.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DirectMessageEditEvent {
    private Long messageId;
    private Long directMessageId;
    private String content;
    private Boolean edited;
}
