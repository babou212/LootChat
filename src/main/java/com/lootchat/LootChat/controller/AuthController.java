package com.lootchat.LootChat.controller;

import com.lootchat.LootChat.dto.AuthResponse;
import com.lootchat.LootChat.dto.LoginRequest;
import com.lootchat.LootChat.dto.UserResponse;
import com.lootchat.LootChat.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@RequestBody LoginRequest request) {
        try {
            AuthResponse response = authService.login(request);
            System.out.println(request);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(AuthResponse.builder()
                            .message("Invalid username or password")
                            .build());
        }
    }

    @GetMapping("/user")
    public ResponseEntity<UserResponse> getCurrentUser() {
        try {
            UserResponse response = authService.getCurrentUser();
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
    }
}
