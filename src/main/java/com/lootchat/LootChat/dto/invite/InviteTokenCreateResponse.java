package com.lootchat.LootChat.dto.invite;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class InviteTokenCreateResponse {
    private String token;
    private LocalDateTime expiresAt;
    private String invitationUrl;
}
