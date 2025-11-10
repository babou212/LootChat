package com.lootchat.LootChat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WebRTCSignalRequest {
    private Long channelId;
    private WebRTCSignalType type;
    private String fromUserId;
    private String toUserId;
    private Object data; // Can be SDP offer/answer or ICE candidate
}
