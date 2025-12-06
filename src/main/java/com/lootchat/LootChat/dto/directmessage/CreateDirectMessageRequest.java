package com.lootchat.LootChat.dto.directmessage;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateDirectMessageRequest {
    private Long recipientId;
}
