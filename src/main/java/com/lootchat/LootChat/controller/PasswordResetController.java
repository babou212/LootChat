package com.lootchat.LootChat.controller;

import com.lootchat.LootChat.config.RateLimitService;
import com.lootchat.LootChat.dto.*;
import com.lootchat.LootChat.service.PasswordResetService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;

@RestController
@RequestMapping("/api/auth/password")
@RequiredArgsConstructor
public class PasswordResetController {

    private final PasswordResetService passwordResetService;
    private final RateLimitService rateLimitService;
    
    // Rate limits for password reset endpoints
    private static final int MAX_FORGOT_REQUESTS = 3;
    private static final Duration FORGOT_WINDOW = Duration.ofMinutes(15);
    
    private static final int MAX_OTP_ATTEMPTS = 5;
    private static final Duration OTP_WINDOW = Duration.ofMinutes(15);

    /**
     * Request a password reset OTP to be sent to the user's email.
     */
    @PostMapping("/forgot")
    public ResponseEntity<PasswordResetResponse> forgotPassword(
            @Valid @RequestBody ForgotPasswordRequest request,
            HttpServletRequest httpRequest) {
        
        // Rate limit by IP to prevent email enumeration/spam
        String clientIp = getClientIp(httpRequest);
        String rateLimitKey = "forgot:" + clientIp;
        
        if (!rateLimitService.isAllowed(rateLimitKey, MAX_FORGOT_REQUESTS, FORGOT_WINDOW)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(PasswordResetResponse.builder()
                            .success(false)
                            .message("Too many requests. Please try again later.")
                            .build());
        }
        
        PasswordResetResponse response = passwordResetService.requestPasswordReset(request);
        return ResponseEntity.ok(response);
    }

    /**
     * Verify the OTP sent to the user's email.
     */
    @PostMapping("/verify-otp")
    public ResponseEntity<PasswordResetResponse> verifyOtp(
            @Valid @RequestBody VerifyOtpRequest request,
            HttpServletRequest httpRequest) {
        
        // Rate limit by email + IP to prevent OTP brute forcing
        String clientIp = getClientIp(httpRequest);
        String rateLimitKey = "otp:" + request.getEmail().toLowerCase() + ":" + clientIp;
        
        if (!rateLimitService.isAllowed(rateLimitKey, MAX_OTP_ATTEMPTS, OTP_WINDOW)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(PasswordResetResponse.builder()
                            .success(false)
                            .message("Too many verification attempts. Please request a new code.")
                            .build());
        }
        
        PasswordResetResponse response = passwordResetService.verifyOtp(request);
        return ResponseEntity.ok(response);
    }

    /**
     * Reset the user's password after OTP verification.
     */
    @PostMapping("/reset")
    public ResponseEntity<PasswordResetResponse> resetPassword(
            @Valid @RequestBody ResetPasswordRequest request) {
        PasswordResetResponse response = passwordResetService.resetPassword(request);
        return ResponseEntity.ok(response);
    }
    
    /**
     * Extract client IP address, handling proxies and load balancers
     */
    private String getClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0].trim();
        }
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isEmpty()) {
            return xRealIp;
        }
        return request.getRemoteAddr();
    }
}
