package com.lootchat.LootChat.dto.auth;

import lombok.Data;

@Data
public class RegisterWithInviteRequest {
    private String username;
    private String email;
    private String password;
    private String firstName;
    private String lastName;
}
