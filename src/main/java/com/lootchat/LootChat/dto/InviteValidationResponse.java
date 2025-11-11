package com.lootchat.LootChat.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class InviteValidationResponse {
    private boolean valid;
    private String reason;
    private LocalDateTime expiresAt;
}
