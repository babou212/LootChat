package com.lootchat.LootChat.service.auth;

import com.lootchat.LootChat.dto.auth.AuthResponse;
import com.lootchat.LootChat.dto.auth.LoginRequest;
import com.lootchat.LootChat.entity.User;
import com.lootchat.LootChat.repository.UserRepository;
import com.lootchat.LootChat.security.CurrentUserService;
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
    private final CurrentUserService currentUserService;

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

        var accessToken = jwtService.generateToken(user);
        var refreshToken = jwtService.generateRefreshToken(user);

        return AuthResponse.builder()
                .token(accessToken)
                .refreshToken(refreshToken)
                .userId(String.valueOf(user.getId()))
                .username(user.getUsername())
                .email(user.getEmail())
                .avatar(user.getAvatar())
                .role(user.getRole().name())
                .message("Login successful")
                .build();
    }

    /**
     * Refresh the access token using a valid refresh token.
     * The refresh token must be valid and not expired (7 days).
     * Returns a new access token (15 minutes) - refresh token stays the same.
     */
    public AuthResponse refreshToken() {
        User user = currentUserService.getCurrentUserOrThrow();
        
        var newAccessToken = jwtService.generateToken(user);
        
        return AuthResponse.builder()
                .token(newAccessToken)
                .userId(String.valueOf(user.getId()))
                .username(user.getUsername())
                .email(user.getEmail())
                .avatar(user.getAvatar())
                .role(user.getRole().name())
                .message("Token refreshed successfully")
                .build();
    }
}
