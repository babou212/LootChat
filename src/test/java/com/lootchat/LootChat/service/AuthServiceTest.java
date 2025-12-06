package com.lootchat.LootChat.service;

import com.lootchat.LootChat.dto.auth.AuthResponse;
import com.lootchat.LootChat.dto.auth.LoginRequest;
import com.lootchat.LootChat.entity.Role;
import com.lootchat.LootChat.entity.User;
import com.lootchat.LootChat.repository.UserRepository;
import com.lootchat.LootChat.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("AuthService Tests")
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtService jwtService;

    @InjectMocks
    private AuthService authService;

    private User testUser;
    private LoginRequest loginRequest;

    @BeforeEach
    void setUp() {
        testUser = User.builder()
                .id(1L)
                .username("testuser")
                .email("test@example.com")
                .password("encodedPassword")
                .role(Role.USER)
                .avatar("/api/files/images/avatar.jpg")
                .build();

        loginRequest = new LoginRequest();
        loginRequest.setUsername("testuser");
        loginRequest.setPassword("password123");
    }

    @Test
    @DisplayName("login should return success response with token when credentials are valid")
    void login_ShouldReturnSuccess_WhenCredentialsValid() {
        String expectedToken = "jwt-token-12345";
        when(userRepository.findByUsername("testuser")).thenReturn(testUser);
        when(passwordEncoder.matches("password123", "encodedPassword")).thenReturn(true);
        when(jwtService.generateToken(testUser)).thenReturn(expectedToken);

        AuthResponse response = authService.login(loginRequest);

        assertThat(response).isNotNull();
        assertThat(response.getToken()).isEqualTo(expectedToken);
        assertThat(response.getUserId()).isEqualTo("1");
        assertThat(response.getUsername()).isEqualTo("testuser");
        assertThat(response.getEmail()).isEqualTo("test@example.com");
        assertThat(response.getAvatar()).isEqualTo("/api/files/images/avatar.jpg");
        assertThat(response.getRole()).isEqualTo("USER");
        assertThat(response.getMessage()).isEqualTo("Login successful");
        
        verify(userRepository, times(1)).findByUsername("testuser");
        verify(passwordEncoder, times(1)).matches("password123", "encodedPassword");
        verify(jwtService, times(1)).generateToken(testUser);
    }

    @Test
    @DisplayName("login should return error message when username not found")
    void login_ShouldReturnError_WhenUsernameNotFound() {
        when(userRepository.findByUsername("nonexistent")).thenReturn(null);

        loginRequest.setUsername("nonexistent");

        AuthResponse response = authService.login(loginRequest);

        assertThat(response).isNotNull();
        assertThat(response.getToken()).isNull();
        assertThat(response.getMessage()).isEqualTo("Invalid username or password");
        
        verify(userRepository, times(1)).findByUsername("nonexistent");
        verify(passwordEncoder, never()).matches(any(), any());
        verify(jwtService, never()).generateToken(any());
    }

    @Test
    @DisplayName("login should return error message when password is incorrect")
    void login_ShouldReturnError_WhenPasswordIncorrect() {
        when(userRepository.findByUsername("testuser")).thenReturn(testUser);
        when(passwordEncoder.matches("wrongpassword", "encodedPassword")).thenReturn(false);

        loginRequest.setPassword("wrongpassword");

        AuthResponse response = authService.login(loginRequest);

        assertThat(response).isNotNull();
        assertThat(response.getToken()).isNull();
        assertThat(response.getMessage()).isEqualTo("Invalid username or password");
        
        verify(userRepository, times(1)).findByUsername("testuser");
        verify(passwordEncoder, times(1)).matches("wrongpassword", "encodedPassword");
        verify(jwtService, never()).generateToken(any());
    }

    @Test
    @DisplayName("login should handle user with null avatar")
    void login_ShouldHandleNullAvatar() {
        testUser.setAvatar(null);
        String expectedToken = "jwt-token-12345";
        
        when(userRepository.findByUsername("testuser")).thenReturn(testUser);
        when(passwordEncoder.matches("password123", "encodedPassword")).thenReturn(true);
        when(jwtService.generateToken(testUser)).thenReturn(expectedToken);

        AuthResponse response = authService.login(loginRequest);

        assertThat(response).isNotNull();
        assertThat(response.getToken()).isEqualTo(expectedToken);
        assertThat(response.getAvatar()).isNull();
        assertThat(response.getMessage()).isEqualTo("Login successful");
    }

    @Test
    @DisplayName("login should work for admin users")
    void login_ShouldWork_ForAdminUsers() {
        testUser.setRole(Role.ADMIN);
        String expectedToken = "jwt-token-admin";
        
        when(userRepository.findByUsername("testuser")).thenReturn(testUser);
        when(passwordEncoder.matches("password123", "encodedPassword")).thenReturn(true);
        when(jwtService.generateToken(testUser)).thenReturn(expectedToken);

        AuthResponse response = authService.login(loginRequest);

        assertThat(response).isNotNull();
        assertThat(response.getRole()).isEqualTo("ADMIN");
        assertThat(response.getToken()).isEqualTo(expectedToken);
    }

    @Test
    @DisplayName("login should work for moderator users")
    void login_ShouldWork_ForModeratorUsers() {
        testUser.setRole(Role.MODERATOR);
        String expectedToken = "jwt-token-moderator";
        
        when(userRepository.findByUsername("testuser")).thenReturn(testUser);
        when(passwordEncoder.matches("password123", "encodedPassword")).thenReturn(true);
        when(jwtService.generateToken(testUser)).thenReturn(expectedToken);

        AuthResponse response = authService.login(loginRequest);

        assertThat(response).isNotNull();
        assertThat(response.getRole()).isEqualTo("MODERATOR");
        assertThat(response.getToken()).isEqualTo(expectedToken);
    }
}
