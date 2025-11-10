package com.lootchat.LootChat.service;

import com.lootchat.LootChat.dto.AuthResponse;
import com.lootchat.LootChat.dto.LoginRequest;
import com.lootchat.LootChat.repository.UserRepository;
import com.lootchat.LootChat.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthResponse login(LoginRequest request) {
        var user = userRepository.findByUsername(request.getUsername());

        if (user == null) {
            return AuthResponse.builder()
                    .message("Invalid username or password")
                    .build();
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            return AuthResponse.builder()
                    .message("Invalid username or password")
                    .build();
        }

        var jwtToken = jwtService.generateToken(user);

        return AuthResponse.builder()
                .token(jwtToken)
                .username(user.getUsername())
                .email(user.getEmail())
                .avatar(user.getAvatar())
                .role(user.getRole().name())
                .message("Login successful")
                .build();
    }
}
