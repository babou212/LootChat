package com.lootchat.LootChat.controller.auth;

import com.lootchat.LootChat.config.RateLimitService;
import com.lootchat.LootChat.dto.auth.AuthResponse;
import com.lootchat.LootChat.dto.auth.LoginRequest;
import com.lootchat.LootChat.service.auth.AuthService;
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
    
    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final Duration LOCKOUT_DURATION = Duration.ofMinutes(5);

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest httpRequest) {
        
        String username = request.getUsername();
        String clientIp = getClientIp(httpRequest);
        
        // Check if account is locked out
        String lockoutKey = "lockout:" + username;
        if (rateLimitService.isLocked(lockoutKey)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(AuthResponse.builder()
                            .message("Account temporarily locked due to multiple failed login attempts. Please try again in 5 minutes.")
                            .build());
        }
        
        // Rate limit by IP address to prevent brute force attacks
        String rateLimitKey = "login:" + clientIp;
        if (!rateLimitService.isAllowed(rateLimitKey, MAX_LOGIN_ATTEMPTS, LOGIN_WINDOW)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(AuthResponse.builder()
                            .message("Too many login attempts. Please try again later.")
                            .build());
        }
        
        AuthResponse response = authService.login(request);

        if (response.getToken() != null) {
            // Successful login - reset failed attempts
            rateLimitService.reset("failed:" + username);
            return ResponseEntity.ok(response);
        } else {
            // Failed login - track failed attempts
            String failedKey = "failed:" + username;
            
            // Check if this exceeds max failed attempts
            if (!rateLimitService.isAllowed(failedKey, MAX_FAILED_ATTEMPTS, LOCKOUT_DURATION)) {
                // Lock out the account
                rateLimitService.setLockout(lockoutKey, LOCKOUT_DURATION);
            }
            
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
