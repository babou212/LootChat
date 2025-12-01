package com.lootchat.LootChat.service;

import com.lootchat.LootChat.dto.ChangePasswordRequest;
import com.lootchat.LootChat.dto.UserResponse;
import com.lootchat.LootChat.entity.User;
import com.lootchat.LootChat.repository.UserRepository;
import com.lootchat.LootChat.security.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.CacheManager;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserService {
    private final UserRepository userRepository;
    private final CurrentUserService currentUserService;
    private final PasswordEncoder passwordEncoder;
    private final S3FileStorageService s3FileStorageService;
    private final CacheManager cacheManager;

    @Cacheable(cacheNames = "users", key = "'all'")
    @Transactional(readOnly = true)
    public List<UserResponse> getAllUsers() {
        return userRepository.findAll().stream()
                .map(this::mapToUserResponse)
                .collect(Collectors.toList());
    }

    @Cacheable(cacheNames = "user", key = "'id:' + #id")
    @Transactional(readOnly = true)
    public UserResponse getUserById(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found with id: " + id));
        return mapToUserResponse(user);
    }

    @Transactional
    public void changePassword(ChangePasswordRequest request) {
        Long userId = currentUserService.getCurrentUserIdOrThrow();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Current password is incorrect");
        }

        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "New password and confirm password do not match");
        }

        String password = request.getNewPassword();
        if (password.length() < 12) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must be at least 12 characters long");
        }
        if (!password.matches(".*[a-z].*")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must contain at least one lowercase letter");
        }
        if (!password.matches(".*[A-Z].*")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must contain at least one uppercase letter");
        }
        if (!password.matches(".*\\d.*")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must contain at least one number");
        }
        if (!password.matches(".*[@$!%*?&].*")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must contain at least one special character (@$!%*?&)");
        }

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
    }

    public boolean usernameExists(String username) {
        System.out.println("UserService.usernameExists called with: " + username);
        boolean exists = userRepository.existsByUsername(username);
        System.out.println("Repository returned: " + exists);
        return exists;
    }

    public boolean emailExists(String email) {
        System.out.println("UserService.emailExists called with: " + email);
        boolean exists = userRepository.existsByEmail(email);
        System.out.println("Repository returned: " + exists);
        return exists;
    }

    @Transactional
    public String uploadAvatar(MultipartFile file) {
        Long userId = currentUserService.getCurrentUserIdOrThrow();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        // Validate file
        if (file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Avatar file is empty");
        }

        if (file.getSize() > 5 * 1024 * 1024) { // 5MB limit for avatars
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Avatar file size exceeds 5MB limit");
        }

        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Avatar must be an image file");
        }

        try {
            // Delete old avatar if exists
            if (user.getAvatar() != null && !user.getAvatar().isEmpty()) {
                try {
                    String oldFileName = user.getAvatar().substring(user.getAvatar().lastIndexOf('/') + 1);
                    s3FileStorageService.deleteFile(oldFileName);
                } catch (Exception e) {
                    // Log but don't fail if old avatar deletion fails
                }
            }

            // Upload new avatar
            String fileName = s3FileStorageService.storeFile(file);
            String avatarUrl = "/api/files/images/" + fileName;
            
            // Update user's avatar
            user.setAvatar(avatarUrl);
            userRepository.save(user);
            
            var userCache = cacheManager.getCache("user");
            if (userCache != null) {
                userCache.evict("id:" + userId);
            }
            var usersCache = cacheManager.getCache("users");
            if (usersCache != null) {
                usersCache.evict("all");
            }
            
            return avatarUrl;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to upload avatar: " + e.getMessage());
        }
    }

    private UserResponse mapToUserResponse(User user) {
        return UserResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .avatar(user.getAvatar())
                .role(user.getRole())
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .build();
    }
}
