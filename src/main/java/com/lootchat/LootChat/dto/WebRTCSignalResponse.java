package com.lootchat.LootChat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WebRTCSignalResponse {
    private Long channelId;
    private WebRTCSignalType type;
    private String fromUserId;
    private String fromUsername;
    private String toUserId;
    private Object data;
}
