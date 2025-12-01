package com.lootchat.LootChat.controller;

import com.lootchat.LootChat.config.RateLimitService;
import com.lootchat.LootChat.dto.AuthResponse;
import com.lootchat.LootChat.dto.LoginRequest;
import com.lootchat.LootChat.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService authService;
    private final RateLimitService rateLimitService;
    
    // Rate limit: 5 login attempts per minute per IP
    private static final int MAX_LOGIN_ATTEMPTS = 5;
    private static final Duration LOGIN_WINDOW = Duration.ofMinutes(1);

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest httpRequest) {
        
        // Rate limit by IP address to prevent brute force attacks
        String clientIp = getClientIp(httpRequest);
        String rateLimitKey = "login:" + clientIp;
        
        if (!rateLimitService.isAllowed(rateLimitKey, MAX_LOGIN_ATTEMPTS, LOGIN_WINDOW)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(AuthResponse.builder()
                            .message("Too many login attempts. Please try again later.")
                            .build());
        }
        
        AuthResponse response = authService.login(request);

        if (response.getToken() != null) {
            return ResponseEntity.ok(response);
        } else {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
        }
    }

    /**
     * Refresh the JWT token for the currently authenticated user.
     * Requires a valid Bearer token in the Authorization header.
     * Returns a new token with fresh expiration time.
     */
    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh() {
        AuthResponse response = authService.refreshToken();
        return ResponseEntity.ok(response);
    }
    
    /**
     * Extract client IP address, handling proxies and load balancers
     */
    private String getClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            // Take the first IP in the chain (original client)
            return xForwardedFor.split(",")[0].trim();
        }
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isEmpty()) {
            return xRealIp;
        }
        return request.getRemoteAddr();
    }
}
