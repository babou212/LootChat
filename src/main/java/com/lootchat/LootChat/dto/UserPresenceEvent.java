package com.lootchat.LootChat.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserPresenceEvent {
    private Long userId;
    private String username;
    private String status; 
}
