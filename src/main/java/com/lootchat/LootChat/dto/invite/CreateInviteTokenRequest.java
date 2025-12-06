package com.lootchat.LootChat.dto.invite;

import lombok.Data;

@Data
public class CreateInviteTokenRequest {
    private Integer expiresInHours; // optional, default 72h
}
