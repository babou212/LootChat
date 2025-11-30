package com.lootchat.LootChat.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String fromEmail;

    @Value("${app.name:LootChat}")
    private String appName;

    public void sendWelcomeEmail(String toEmail, String username) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromEmail);
            message.setTo(toEmail);
            message.setSubject("Welcome to " + appName + "!");
            message.setText(buildWelcomeEmailBody(username));

            mailSender.send(message);
            log.info("Welcome email sent successfully to: {}", toEmail);
        } catch (Exception e) {
            log.error("Failed to send welcome email to: {}", toEmail, e);
        }
    }

    private String buildWelcomeEmailBody(String username) {
        return String.format("""
                Hello %s,
                
                Welcome to %s! Your account has been successfully created.
                
                You can now log in and start chatting.
                
                If you have any questions or need assistance, please don't hesitate to reach out.
                
                Best regards,
                The %s Team
                """, username, appName, appName);
    }

    public void sendPasswordChangeConfirmation(String toEmail, String username) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromEmail);
            message.setTo(toEmail);
            message.setSubject("Password Changed - " + appName);
            message.setText(buildPasswordChangeEmailBody(username));

            mailSender.send(message);
            log.info("Password change confirmation email sent to: {}", toEmail);
        } catch (Exception e) {
            log.error("Failed to send password change email to: {}", toEmail, e);
        }
    }

    private String buildPasswordChangeEmailBody(String username) {
        return String.format("""
                Hello %s,
                
                Your password for %s has been successfully changed.
                
                If you did not make this change, please contact support immediately.
                
                Best regards,
                The %s Team
                """, username, appName, appName);
    }

    public void sendPasswordResetOtp(String toEmail, String username, String otp) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromEmail);
            message.setTo(toEmail);
            message.setSubject("Password Reset Code - " + appName);
            message.setText(buildPasswordResetOtpEmailBody(username, otp));

            mailSender.send(message);
            log.info("Password reset OTP email sent to: {}", toEmail);
        } catch (Exception e) {
            log.error("Failed to send password reset OTP email to: {}", toEmail, e);
            throw new RuntimeException("Failed to send password reset email", e);
        }
    }

    private String buildPasswordResetOtpEmailBody(String username, String otp) {
        return String.format("""
                Hello %s,
                
                You have requested to reset your password for %s.
                
                Your verification code is: %s
                
                This code will expire in 15 minutes.
                
                If you did not request a password reset, please ignore this email or contact support if you have concerns.
                
                Best regards,
                The %s Team
                """, username, appName, otp, appName);
    }
}
