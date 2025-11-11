package com.lootchat.LootChat.controller;

import com.lootchat.LootChat.dto.UserResponse;
import com.lootchat.LootChat.service.UserPresenceService;
import com.lootchat.LootChat.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {
    private final UserService userService;
    private final UserPresenceService userPresenceService;

    @GetMapping
    public ResponseEntity<List<UserResponse>> getAllUsers() {
        return ResponseEntity.ok(userService.getAllUsers());
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserResponse> getUserById(@PathVariable Long id) {
        return ResponseEntity.ok(userService.getUserById(id));
    }
    
    @GetMapping("/presence")
    public ResponseEntity<Map<Long, Boolean>> getUserPresence() {
        return ResponseEntity.ok(userPresenceService.getAllUserPresence());
    }
}
