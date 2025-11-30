package com.lootchat.LootChat.controller;

import com.lootchat.LootChat.dto.*;
import com.lootchat.LootChat.service.PasswordResetService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth/password")
@RequiredArgsConstructor
public class PasswordResetController {

    private final PasswordResetService passwordResetService;

    /**
     * Request a password reset OTP to be sent to the user's email.
     */
    @PostMapping("/forgot")
    public ResponseEntity<PasswordResetResponse> forgotPassword(
            @Valid @RequestBody ForgotPasswordRequest request) {
        PasswordResetResponse response = passwordResetService.requestPasswordReset(request);
        return ResponseEntity.ok(response);
    }

    /**
     * Verify the OTP sent to the user's email.
     */
    @PostMapping("/verify-otp")
    public ResponseEntity<PasswordResetResponse> verifyOtp(
            @Valid @RequestBody VerifyOtpRequest request) {
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
}
