package com.lootchat.LootChat.service;

import com.lootchat.LootChat.dto.*;
import com.lootchat.LootChat.entity.PasswordResetToken;
import com.lootchat.LootChat.entity.User;
import com.lootchat.LootChat.repository.PasswordResetTokenRepository;
import com.lootchat.LootChat.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Slf4j
public class PasswordResetService {

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository tokenRepository;
    private final EmailService emailService;
    private final PasswordEncoder passwordEncoder;
    
    private static final int OTP_LENGTH = 6;
    private static final int OTP_EXPIRY_MINUTES = 15;
    private final SecureRandom secureRandom = new SecureRandom();

    @Transactional
    public PasswordResetResponse requestPasswordReset(ForgotPasswordRequest request) {
        String email = request.getEmail().toLowerCase().trim();
        
        User user = userRepository.findByEmail(email);
        
        if (user == null) {
            log.info("Password reset requested for non-existent email: {}", email);
            return PasswordResetResponse.builder()
                    .success(false)
                    .message("No account found with this email address")
                    .build();
        }

        tokenRepository.invalidateAllTokensForEmail(email);

        String otp = generateOtp();
        
        PasswordResetToken token = PasswordResetToken.builder()
                .email(email)
                .otpCode(otp)
                .expiresAt(LocalDateTime.now().plusMinutes(OTP_EXPIRY_MINUTES))
                .build();
        
        tokenRepository.save(token);
        
        emailService.sendPasswordResetOtp(email, user.getUsername(), otp);
        
        log.info("Password reset OTP sent to: {}", email);
        
        return PasswordResetResponse.builder()
                .success(true)
                .message("If an account exists with this email, you will receive a verification code shortly")
                .build();
    }

    @Transactional
    public PasswordResetResponse verifyOtp(VerifyOtpRequest request) {
        String email = request.getEmail().toLowerCase().trim();
        String otp = request.getOtp().trim();
        
        var tokenOpt = tokenRepository.findByEmailAndOtpCodeAndUsedFalse(email, otp);
        
        if (tokenOpt.isEmpty()) {
            log.warn("Invalid OTP verification attempt for email: {}", email);
            return PasswordResetResponse.builder()
                    .success(false)
                    .message("Invalid or expired verification code")
                    .build();
        }
        
        PasswordResetToken token = tokenOpt.get();
        
        if (token.isExpired()) {
            log.warn("Expired OTP used for email: {}", email);
            return PasswordResetResponse.builder()
                    .success(false)
                    .message("Verification code has expired. Please request a new one")
                    .build();
        }
        
        token.setVerified(true);
        tokenRepository.save(token);
        
        log.info("OTP verified successfully for email: {}", email);
        
        return PasswordResetResponse.builder()
                .success(true)
                .message("Verification successful. You can now reset your password")
                .build();
    }

    @Transactional
    public PasswordResetResponse resetPassword(ResetPasswordRequest request) {
        String email = request.getEmail().toLowerCase().trim();
        
        var tokenOpt = tokenRepository.findByEmailAndVerifiedTrueAndUsedFalse(email);
        
        if (tokenOpt.isEmpty()) {
            log.warn("Password reset attempt without verified OTP for email: {}", email);
            return PasswordResetResponse.builder()
                    .success(false)
                    .message("Please verify your email first")
                    .build();
        }
        
        PasswordResetToken token = tokenOpt.get();
        
        if (token.isExpired()) {
            log.warn("Expired token used for password reset: {}", email);
            return PasswordResetResponse.builder()
                    .success(false)
                    .message("Session expired. Please request a new verification code")
                    .build();
        }
        
        User user = userRepository.findByEmail(email);
        
        if (user == null) {
            log.error("User not found during password reset for email: {}", email);
            return PasswordResetResponse.builder()
                    .success(false)
                    .message("User not found")
                    .build();
        }
        
        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
        
        token.setUsed(true);
        tokenRepository.save(token);
        
        emailService.sendPasswordChangeConfirmation(email, user.getUsername());
        
        log.info("Password reset successful for user: {}", user.getUsername());
        
        return PasswordResetResponse.builder()
                .success(true)
                .message("Password reset successful. You can now log in with your new password")
                .build();
    }

    private String generateOtp() {
        int otp = secureRandom.nextInt(900000) + 100000;
        return String.valueOf(otp);
    }

    @Transactional
    public void cleanupExpiredTokens() {
        tokenRepository.deleteExpiredTokens(LocalDateTime.now());
        log.info("Cleaned up expired password reset tokens");
    }
}
