package com.lootchat.LootChat.dto;

public record MessageSearchRequest(
        String query,
        String channelName,
        String username,
        int page,
        int size

) {
}
