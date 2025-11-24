package com.lootchat.LootChat.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateMessageRequest {
    private String content;
    private Long userId;
    private Long channelId;
    private Long replyToMessageId;
}
