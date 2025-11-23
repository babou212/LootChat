package com.lootchat.LootChat.service;

import com.lootchat.LootChat.dto.UserResponse;
import com.lootchat.LootChat.entity.Role;
import com.lootchat.LootChat.entity.User;
import com.lootchat.LootChat.repository.UserRepository;
import com.lootchat.LootChat.security.CurrentUserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("UserService Tests")
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private CurrentUserService currentUserService;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private S3FileStorageService s3FileStorageService;

    @Mock
    private CacheManager cacheManager;

    @Mock
    private Cache userCache;

    @Mock
    private Cache usersCache;

    @InjectMocks
    private UserService userService;

    private User testUser;
    private User anotherUser;

    @BeforeEach
    void setUp() {
        testUser = User.builder()
                .id(1L)
                .username("testuser")
                .email("test@example.com")
                .firstName("Test")
                .lastName("User")
                .avatar("/api/files/images/avatar1.jpg")
                .role(Role.USER)
                .password("encodedPassword")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        anotherUser = User.builder()
                .id(2L)
                .username("anotheruser")
                .email("another@example.com")
                .firstName("Another")
                .lastName("User")
                .role(Role.USER)
                .password("encodedPassword")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
    }

    @Test
    @DisplayName("getAllUsers should return all users as UserResponse")
    void getAllUsers_ShouldReturnAllUsers() {
        when(userRepository.findAll()).thenReturn(Arrays.asList(testUser, anotherUser));

        List<UserResponse> result = userService.getAllUsers();

        assertThat(result).hasSize(2);
        assertThat(result.get(0).getUsername()).isEqualTo("testuser");
        assertThat(result.get(1).getUsername()).isEqualTo("anotheruser");
        verify(userRepository, times(1)).findAll();
    }

    @Test
    @DisplayName("getAllUsers should return empty list when no users exist")
    void getAllUsers_ShouldReturnEmptyList_WhenNoUsers() {
        when(userRepository.findAll()).thenReturn(List.of());

        List<UserResponse> result = userService.getAllUsers();

        assertThat(result).isEmpty();
        verify(userRepository, times(1)).findAll();
    }

    @Test
    @DisplayName("getUserById should return user when found")
    void getUserById_ShouldReturnUser_WhenUserExists() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));

        UserResponse result = userService.getUserById(1L);

        assertThat(result).isNotNull();
        assertThat(result.getId()).isEqualTo(1L);
        assertThat(result.getUsername()).isEqualTo("testuser");
        assertThat(result.getEmail()).isEqualTo("test@example.com");
        assertThat(result.getAvatar()).isEqualTo("/api/files/images/avatar1.jpg");
        verify(userRepository, times(1)).findById(1L);
    }

    @Test
    @DisplayName("getUserById should throw exception when user not found")
    void getUserById_ShouldThrowException_WhenUserNotFound() {
        when(userRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.getUserById(999L))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("User not found with id: 999");
        verify(userRepository, times(1)).findById(999L);
    }

    @Test
    @DisplayName("uploadAvatar should upload file and update user avatar")
    void uploadAvatar_ShouldUploadAndUpdateAvatar() {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "avatar.jpg",
                "image/jpeg",
                "image data".getBytes()
        );
        
        when(currentUserService.getCurrentUserIdOrThrow()).thenReturn(1L);
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(s3FileStorageService.storeFile(any())).thenReturn("new-avatar.jpg");
        when(cacheManager.getCache("user")).thenReturn(userCache);
        when(cacheManager.getCache("users")).thenReturn(usersCache);

        String result = userService.uploadAvatar(file);

        assertThat(result).isEqualTo("/api/files/images/new-avatar.jpg");
        assertThat(testUser.getAvatar()).isEqualTo("/api/files/images/new-avatar.jpg");
        verify(s3FileStorageService, times(1)).storeFile(file);
        verify(userRepository, times(1)).save(testUser);
        verify(userCache, times(1)).evict("id:1");
        verify(usersCache, times(1)).evict("all");
    }

    @Test
    @DisplayName("uploadAvatar should delete old avatar before uploading new one")
    void uploadAvatar_ShouldDeleteOldAvatar_BeforeUploadingNew() {
        testUser.setAvatar("/api/files/images/old-avatar.jpg");
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "avatar.jpg",
                "image/jpeg",
                "image data".getBytes()
        );
        
        when(currentUserService.getCurrentUserIdOrThrow()).thenReturn(1L);
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(s3FileStorageService.storeFile(any())).thenReturn("new-avatar.jpg");
        when(cacheManager.getCache("user")).thenReturn(userCache);
        when(cacheManager.getCache("users")).thenReturn(usersCache);

        userService.uploadAvatar(file);

        verify(s3FileStorageService, times(1)).deleteFile("old-avatar.jpg");
        verify(s3FileStorageService, times(1)).storeFile(file);
    }

    @Test
    @DisplayName("uploadAvatar should throw exception when file is empty")
    void uploadAvatar_ShouldThrowException_WhenFileIsEmpty() {
        MockMultipartFile emptyFile = new MockMultipartFile(
                "file",
                "avatar.jpg",
                "image/jpeg",
                new byte[0]
        );
        
        when(currentUserService.getCurrentUserIdOrThrow()).thenReturn(1L);
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));

        assertThatThrownBy(() -> userService.uploadAvatar(emptyFile))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Avatar file is empty")
                .extracting("status")
                .isEqualTo(HttpStatus.BAD_REQUEST);
        
        verify(s3FileStorageService, never()).storeFile(any());
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("uploadAvatar should throw exception when file exceeds size limit")
    void uploadAvatar_ShouldThrowException_WhenFileTooLarge() {
        byte[] largeData = new byte[6 * 1024 * 1024]; // 6MB
        MockMultipartFile largeFile = new MockMultipartFile(
                "file",
                "avatar.jpg",
                "image/jpeg",
                largeData
        );
        
        when(currentUserService.getCurrentUserIdOrThrow()).thenReturn(1L);
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));

        assertThatThrownBy(() -> userService.uploadAvatar(largeFile))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Avatar file size exceeds 5MB limit")
                .extracting("status")
                .isEqualTo(HttpStatus.BAD_REQUEST);
        
        verify(s3FileStorageService, never()).storeFile(any());
    }

    @Test
    @DisplayName("uploadAvatar should throw exception when file is not an image")
    void uploadAvatar_ShouldThrowException_WhenFileIsNotImage() {
        MockMultipartFile textFile = new MockMultipartFile(
                "file",
                "document.txt",
                "text/plain",
                "text data".getBytes()
        );
        
        when(currentUserService.getCurrentUserIdOrThrow()).thenReturn(1L);
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));

        assertThatThrownBy(() -> userService.uploadAvatar(textFile))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Avatar must be an image file")
                .extracting("status")
                .isEqualTo(HttpStatus.BAD_REQUEST);
        
        verify(s3FileStorageService, never()).storeFile(any());
    }

    @Test
    @DisplayName("uploadAvatar should throw exception when user not found")
    void uploadAvatar_ShouldThrowException_WhenUserNotFound() {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "avatar.jpg",
                "image/jpeg",
                "image data".getBytes()
        );
        
        when(currentUserService.getCurrentUserIdOrThrow()).thenReturn(999L);
        when(userRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.uploadAvatar(file))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("User not found")
                .extracting("status")
                .isEqualTo(HttpStatus.NOT_FOUND);
        
        verify(s3FileStorageService, never()).storeFile(any());
    }

    @Test
    @DisplayName("usernameExists should return true when username exists")
    void usernameExists_ShouldReturnTrue_WhenUsernameExists() {
        when(userRepository.existsByUsername("testuser")).thenReturn(true);

        boolean result = userService.usernameExists("testuser");

        assertThat(result).isTrue();
        verify(userRepository, times(1)).existsByUsername("testuser");
    }

    @Test
    @DisplayName("usernameExists should return false when username does not exist")
    void usernameExists_ShouldReturnFalse_WhenUsernameDoesNotExist() {
        when(userRepository.existsByUsername("nonexistent")).thenReturn(false);

        boolean result = userService.usernameExists("nonexistent");

        assertThat(result).isFalse();
        verify(userRepository, times(1)).existsByUsername("nonexistent");
    }

    @Test
    @DisplayName("emailExists should return true when email exists")
    void emailExists_ShouldReturnTrue_WhenEmailExists() {
        when(userRepository.existsByEmail("test@example.com")).thenReturn(true);

        boolean result = userService.emailExists("test@example.com");

        assertThat(result).isTrue();
        verify(userRepository, times(1)).existsByEmail("test@example.com");
    }

    @Test
    @DisplayName("emailExists should return false when email does not exist")
    void emailExists_ShouldReturnFalse_WhenEmailDoesNotExist() {
        when(userRepository.existsByEmail("nonexistent@example.com")).thenReturn(false);

        boolean result = userService.emailExists("nonexistent@example.com");

        assertThat(result).isFalse();
        verify(userRepository, times(1)).existsByEmail("nonexistent@example.com");
    }
}
