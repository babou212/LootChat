package com.lootchat.LootChat.dto.user;

import com.lootchat.LootChat.entity.Role;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserResponse {
    private Long id;
    private String username;
    private String email;
    private String firstName;
    private String lastName;
    private String avatar;
    private Role role;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
