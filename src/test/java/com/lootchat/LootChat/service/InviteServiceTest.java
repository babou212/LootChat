package com.lootchat.LootChat.service;

import com.lootchat.LootChat.dto.invite.*;
import com.lootchat.LootChat.dto.auth.AuthResponse;
import com.lootchat.LootChat.entity.InviteToken;
import com.lootchat.LootChat.entity.Role;
import com.lootchat.LootChat.entity.User;
import com.lootchat.LootChat.repository.InviteTokenRepository;
import com.lootchat.LootChat.repository.UserRepository;
import com.lootchat.LootChat.security.CurrentUserService;
import com.lootchat.LootChat.security.JwtService;
import com.lootchat.LootChat.service.common.EmailService;
import com.lootchat.LootChat.service.invite.InviteService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("InviteService Tests")
class InviteServiceTest {

    @Mock
    private InviteTokenRepository inviteTokenRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtService jwtService;

    @Mock
    private CurrentUserService currentUserService;

    @Mock
    private EmailService emailService;

    @InjectMocks
    private InviteService inviteService;

    private User adminUser;
    private User regularUser;
    private InviteToken validInvite;
    private CreateInviteTokenRequest createRequest;

    @BeforeEach
    void setUp() {
        adminUser = User.builder()
                .id(1L)
                .username("admin")
                .email("admin@example.com")
                .role(Role.ADMIN)
                .build();

        regularUser = User.builder()
                .id(2L)
                .username("user")
                .email("user@example.com")
                .role(Role.USER)
                .build();

        validInvite = InviteToken.builder()
                .id(1L)
                .token("valid-token-123")
                .expiresAt(LocalDateTime.now().plusMinutes(10))
                .createdBy(adminUser)
                .revoked(false)
                .usedAt(null)
                .usedBy(null)
                .build();

        createRequest = new CreateInviteTokenRequest();
    }

    @Test
    @DisplayName("createInvite should create invite when user is admin")
    void createInvite_ShouldCreateInvite_WhenUserIsAdmin() {
        String baseUrl = "https://example.com";
        when(currentUserService.getCurrentUserOrThrow()).thenReturn(adminUser);
        when(inviteTokenRepository.existsByToken(any())).thenReturn(false);
        when(inviteTokenRepository.save(any(InviteToken.class))).thenAnswer(invocation -> invocation.getArgument(0));

        InviteTokenCreateResponse response = inviteService.createInvite(createRequest, baseUrl);

        assertThat(response).isNotNull();
        assertThat(response.getToken()).isNotNull();
        assertThat(response.getExpiresAt()).isAfter(LocalDateTime.now());
        assertThat(response.getInvitationUrl()).startsWith(baseUrl + "/invite/");
        
        verify(inviteTokenRepository, times(1)).save(any(InviteToken.class));
    }

    @Test
    @DisplayName("createInvite should handle base URL with trailing slash")
    void createInvite_ShouldHandleTrailingSlash_InBaseUrl() {
        String baseUrl = "https://example.com/";
        when(currentUserService.getCurrentUserOrThrow()).thenReturn(adminUser);
        when(inviteTokenRepository.existsByToken(any())).thenReturn(false);
        when(inviteTokenRepository.save(any(InviteToken.class))).thenAnswer(invocation -> invocation.getArgument(0));

        InviteTokenCreateResponse response = inviteService.createInvite(createRequest, baseUrl);

        assertThat(response.getInvitationUrl()).doesNotContain("//invite/");
        assertThat(response.getInvitationUrl()).startsWith("https://example.com/invite/");
    }

    @Test
    @DisplayName("createInvite should throw exception when user is not admin")
    void createInvite_ShouldThrowException_WhenUserIsNotAdmin() {
        when(currentUserService.getCurrentUserOrThrow()).thenReturn(regularUser);

        assertThatThrownBy(() -> inviteService.createInvite(createRequest, "https://example.com"))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("Only admins can create invite links");

        verify(inviteTokenRepository, never()).save(any());
    }

    @Test
    @DisplayName("createInvite should retry when token collision occurs")
    void createInvite_ShouldRetry_WhenTokenCollision() {
        when(currentUserService.getCurrentUserOrThrow()).thenReturn(adminUser);
        when(inviteTokenRepository.existsByToken(any()))
                .thenReturn(true)
                .thenReturn(false); // First collision, then success
        when(inviteTokenRepository.save(any(InviteToken.class))).thenAnswer(invocation -> invocation.getArgument(0));

        InviteTokenCreateResponse response = inviteService.createInvite(createRequest, "https://example.com");

        assertThat(response).isNotNull();
        verify(inviteTokenRepository, atLeast(2)).existsByToken(any());
    }

    @Test
    @DisplayName("validate should return valid response for valid invite")
    void validate_ShouldReturnValid_ForValidInvite() {
        when(inviteTokenRepository.findByToken("valid-token-123")).thenReturn(Optional.of(validInvite));

        InviteValidationResponse response = inviteService.validate("valid-token-123");

        assertThat(response).isNotNull();
        assertThat(response.isValid()).isTrue();
        assertThat(response.getReason()).isEqualTo("OK");
        assertThat(response.getExpiresAt()).isEqualTo(validInvite.getExpiresAt());
    }

    @Test
    @DisplayName("validate should return invalid for expired invite")
    void validate_ShouldReturnInvalid_ForExpiredInvite() {
        validInvite.setExpiresAt(LocalDateTime.now().minusMinutes(1));
        when(inviteTokenRepository.findByToken("expired-token")).thenReturn(Optional.of(validInvite));

        InviteValidationResponse response = inviteService.validate("expired-token");

        assertThat(response).isNotNull();
        assertThat(response.isValid()).isFalse();
        assertThat(response.getReason()).isEqualTo("Invite expired");
    }

    @Test
    @DisplayName("validate should return invalid for used invite")
    void validate_ShouldReturnInvalid_ForUsedInvite() {
        validInvite.setUsedAt(LocalDateTime.now().minusMinutes(5));
        validInvite.setUsedBy(regularUser);
        when(inviteTokenRepository.findByToken("used-token")).thenReturn(Optional.of(validInvite));

        InviteValidationResponse response = inviteService.validate("used-token");

        assertThat(response).isNotNull();
        assertThat(response.isValid()).isFalse();
        assertThat(response.getReason()).isEqualTo("Invite already used");
    }

    @Test
    @DisplayName("validate should return invalid for revoked invite")
    void validate_ShouldReturnInvalid_ForRevokedInvite() {
        validInvite.setRevoked(true);
        when(inviteTokenRepository.findByToken("revoked-token")).thenReturn(Optional.of(validInvite));

        InviteValidationResponse response = inviteService.validate("revoked-token");

        assertThat(response).isNotNull();
        assertThat(response.isValid()).isFalse();
        assertThat(response.getReason()).isEqualTo("Invite revoked");
    }

    @Test
    @DisplayName("validate should throw exception when invite not found")
    void validate_ShouldThrowException_WhenInviteNotFound() {
        when(inviteTokenRepository.findByToken("nonexistent")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> inviteService.validate("nonexistent"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Invite not found")
                .extracting("status")
                .isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    @DisplayName("registerWithInvite should register user successfully")
    void registerWithInvite_ShouldRegisterUser_Successfully() {
        RegisterWithInviteRequest request = new RegisterWithInviteRequest();
        request.setUsername("newuser");
        request.setEmail("newuser@example.com");
        request.setPassword("password123");
        request.setFirstName("New");
        request.setLastName("User");

        when(inviteTokenRepository.findByToken("valid-token-123")).thenReturn(Optional.of(validInvite));
        when(userRepository.existsByUsername("newuser")).thenReturn(false);
        when(userRepository.existsByEmail("newuser@example.com")).thenReturn(false);
        when(passwordEncoder.encode("password123")).thenReturn("encodedPassword");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User user = invocation.getArgument(0);
            user.setId(3L);
            return user;
        });
        when(jwtService.generateToken(any(User.class))).thenReturn("jwt-token-123");
        doNothing().when(emailService).sendWelcomeEmail(any(), any());

        AuthResponse response = inviteService.registerWithInvite("valid-token-123", request);

        assertThat(response).isNotNull();
        assertThat(response.getToken()).isEqualTo("jwt-token-123");
        assertThat(response.getUsername()).isEqualTo("newuser");
        assertThat(response.getEmail()).isEqualTo("newuser@example.com");
        assertThat(response.getRole()).isEqualTo("USER");
        assertThat(response.getMessage()).isEqualTo("Registration successful");
        
        verify(userRepository, times(1)).save(any(User.class));
        verify(inviteTokenRepository, times(1)).save(validInvite);
        verify(emailService, times(1)).sendWelcomeEmail("newuser@example.com", "newuser");
        assertThat(validInvite.getUsedAt()).isNotNull();
        assertThat(validInvite.getUsedBy()).isNotNull();
    }

    @Test
    @DisplayName("registerWithInvite should throw exception when invite not found")
    void registerWithInvite_ShouldThrowException_WhenInviteNotFound() {
        RegisterWithInviteRequest request = new RegisterWithInviteRequest();
        when(inviteTokenRepository.findByToken("nonexistent")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> inviteService.registerWithInvite("nonexistent", request))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Invite not found")
                .extracting("status")
                .isEqualTo(HttpStatus.NOT_FOUND);

        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("registerWithInvite should throw exception when invite is expired")
    void registerWithInvite_ShouldThrowException_WhenInviteExpired() {
        validInvite.setExpiresAt(LocalDateTime.now().minusMinutes(1));
        RegisterWithInviteRequest request = new RegisterWithInviteRequest();
        when(inviteTokenRepository.findByToken("expired-token")).thenReturn(Optional.of(validInvite));

        assertThatThrownBy(() -> inviteService.registerWithInvite("expired-token", request))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Invalid or expired invite token")
                .extracting("status")
                .isEqualTo(HttpStatus.BAD_REQUEST);

        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("registerWithInvite should throw exception when username already exists")
    void registerWithInvite_ShouldThrowException_WhenUsernameExists() {
        RegisterWithInviteRequest request = new RegisterWithInviteRequest();
        request.setUsername("existinguser");
        request.setEmail("newuser@example.com");

        when(inviteTokenRepository.findByToken("valid-token-123")).thenReturn(Optional.of(validInvite));
        when(userRepository.existsByUsername("existinguser")).thenReturn(true);

        assertThatThrownBy(() -> inviteService.registerWithInvite("valid-token-123", request))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Username already taken")
                .extracting("status")
                .isEqualTo(HttpStatus.CONFLICT);

        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("registerWithInvite should throw exception when email already exists")
    void registerWithInvite_ShouldThrowException_WhenEmailExists() {
        RegisterWithInviteRequest request = new RegisterWithInviteRequest();
        request.setUsername("newuser");
        request.setEmail("existing@example.com");

        when(inviteTokenRepository.findByToken("valid-token-123")).thenReturn(Optional.of(validInvite));
        when(userRepository.existsByUsername("newuser")).thenReturn(false);
        when(userRepository.existsByEmail("existing@example.com")).thenReturn(true);

        assertThatThrownBy(() -> inviteService.registerWithInvite("valid-token-123", request))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Email already registered")
                .extracting("status")
                .isEqualTo(HttpStatus.CONFLICT);

        verify(userRepository, never()).save(any());
    }
}
