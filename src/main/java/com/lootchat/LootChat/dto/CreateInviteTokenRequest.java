package com.lootchat.LootChat.dto;

import lombok.Data;

@Data
public class CreateInviteTokenRequest {
    private Integer expiresInHours; // optional, default 72h
}
