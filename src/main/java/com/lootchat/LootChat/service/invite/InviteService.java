package com.lootchat.LootChat.service.invite;

import com.lootchat.LootChat.dto.invite.*;
import com.lootchat.LootChat.dto.auth.AuthResponse;
import com.lootchat.LootChat.dto.auth.RegisterWithInviteRequest;
import com.lootchat.LootChat.entity.InviteToken;
import com.lootchat.LootChat.entity.Role;
import com.lootchat.LootChat.entity.User;
import com.lootchat.LootChat.repository.InviteTokenRepository;
import com.lootchat.LootChat.repository.UserRepository;
import com.lootchat.LootChat.security.CurrentUserService;
import com.lootchat.LootChat.security.JwtService;
import com.lootchat.LootChat.service.common.EmailService;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.CacheManager;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class InviteService {

    private final InviteTokenRepository inviteTokenRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final CurrentUserService currentUserService;
    private final EmailService emailService;
    private final CacheManager cacheManager;

    public InviteTokenCreateResponse createInvite(CreateInviteTokenRequest request, String publicBaseUrl) {
        User creator = currentUserService.getCurrentUserOrThrow();
        if (creator.getRole() != Role.ADMIN) {
            throw new AccessDeniedException("Only admins can create invite links");
        }

    int minutes = 10; // default fixed expiry: 10 minutes

        String token;
        int attempts = 0;
        do {
            token = UUID.randomUUID().toString();
            attempts++;
            if (attempts > 5) {
                throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to generate unique token");
            }
        } while (inviteTokenRepository.existsByToken(token));

    InviteToken invite = InviteToken.builder()
        .token(token)
        .expiresAt(LocalDateTime.now().plusMinutes(minutes))
        .createdBy(creator)
        .revoked(false)
        .build();

        inviteTokenRepository.save(invite);

        String url = publicBaseUrl.endsWith("/") ? publicBaseUrl.substring(0, publicBaseUrl.length() - 1) : publicBaseUrl;
        String invitationUrl = url + "/invite/" + token;

        return InviteTokenCreateResponse.builder()
                .token(token)
                .expiresAt(invite.getExpiresAt())
                .invitationUrl(invitationUrl)
                .build();
    }

    public InviteValidationResponse validate(String token) {
        InviteToken invite = inviteTokenRepository.findByToken(token)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invite not found"));

    if (invite.isExpired()) {
        return InviteValidationResponse.builder()
            .valid(false)
            .reason("Invite expired")
            .expiresAt(invite.getExpiresAt())
            .build();
    }
    if (invite.isUsed()) {
        return InviteValidationResponse.builder()
            .valid(false)
            .reason("Invite already used")
            .expiresAt(invite.getExpiresAt())
            .build();
    }
    if (invite.isRevoked()) {
        return InviteValidationResponse.builder()
            .valid(false)
            .reason("Invite revoked")
            .expiresAt(invite.getExpiresAt())
            .build();
    }

    return InviteValidationResponse.builder()
        .valid(true)
        .reason("OK")
        .expiresAt(invite.getExpiresAt())
        .build();
    }

    public AuthResponse registerWithInvite(String token, RegisterWithInviteRequest request) {
        InviteToken invite = inviteTokenRepository.findByToken(token)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invite not found"));

        if (invite.isExpired() || invite.isUsed() || invite.isRevoked()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid or expired invite token");
        }


        if (userRepository.existsByUsername(request.getUsername())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Username already taken");
        }
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered");
        }

        User newUser = User.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .role(Role.USER)
                .isEnabled(true)
                .isAccountNonExpired(true)
                .isAccountNonLocked(true)
                .isCredentialsNonExpired(true)
                .build();
        userRepository.save(newUser);

        var usersCache = cacheManager.getCache("users");
        if (usersCache != null) {
            usersCache.evict("all");
        }

        invite.setUsedAt(LocalDateTime.now());
        invite.setUsedBy(newUser);
        inviteTokenRepository.save(invite);

        emailService.sendWelcomeEmail(newUser.getEmail(), newUser.getUsername());

        String jwtToken = jwtService.generateToken(newUser);

        return AuthResponse.builder()
                .token(jwtToken)
                .userId(String.valueOf(newUser.getId()))
                .username(newUser.getUsername())
                .email(newUser.getEmail())
                .avatar(newUser.getAvatar())
                .role(newUser.getRole().name())
                .message("Registration successful")
                .build();
    }
}
