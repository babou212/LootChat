package com.lootchat.LootChat.controller.user;

import com.lootchat.LootChat.dto.user.ChangePasswordRequest;
import com.lootchat.LootChat.dto.user.UserResponse;
import com.lootchat.LootChat.service.user.UserPresenceService;
import com.lootchat.LootChat.service.user.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {
    private final UserService userService;
    private final UserPresenceService userPresenceService;

    @GetMapping
    public ResponseEntity<List<UserResponse>> getAllUsers() {
        return ResponseEntity.ok(userService.getAllUsers());
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserResponse> getUserById(@PathVariable Long id) {
        return ResponseEntity.ok(userService.getUserById(id));
    }
    
    @GetMapping("/presence")
    public ResponseEntity<Map<Long, Boolean>> getUserPresence() {
        return ResponseEntity.ok(userPresenceService.getAllUserPresence());
    }
    
    /**
     * Heartbeat endpoint to keep user presence alive.
     * Should be called periodically by the frontend (every 2-3 minutes).
     */
    @PostMapping("/presence/heartbeat")
    public ResponseEntity<Void> heartbeat() {
        userPresenceService.refreshCurrentUserPresence();
        return ResponseEntity.ok().build();
    }

    @PutMapping("/password")
    public ResponseEntity<Void> changePassword(@RequestBody ChangePasswordRequest request) {
        userService.changePassword(request);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/check-username/{username}")
    public ResponseEntity<Map<String, Boolean>> checkUsername(@PathVariable String username) {
        System.out.println("Checking username: " + username);
        boolean exists = userService.usernameExists(username);
        System.out.println("Username exists: " + exists);
        return ResponseEntity.ok(Map.of("exists", exists));
    }

    @GetMapping("/check-email/{email}")
    public ResponseEntity<Map<String, Boolean>> checkEmail(@PathVariable String email) {
        System.out.println("Checking email: " + email);
        boolean exists = userService.emailExists(email);
        System.out.println("Email exists: " + exists);
        return ResponseEntity.ok(Map.of("exists", exists));
    }

    @PostMapping("/avatar")
    public ResponseEntity<Map<String, String>> uploadAvatar(@RequestParam("avatar") MultipartFile file) {
        String avatarUrl = userService.uploadAvatar(file);
        return ResponseEntity.ok(Map.of("avatarUrl", avatarUrl));
    }
}
