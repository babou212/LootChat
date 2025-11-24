package com.lootchat.LootChat.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SendDirectMessageRequest {
    private String content;
    private Long directMessageId;
    private Long replyToMessageId;
    private String replyToUsername;
    private String replyToContent;
    private String imageUrl;
    private String imageFilename;
}
