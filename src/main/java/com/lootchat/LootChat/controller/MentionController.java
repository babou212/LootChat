package com.lootchat.LootChat.controller;

import com.lootchat.LootChat.service.MentionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * REST controller for mention-related endpoints.
 */
@RestController
@RequestMapping("/api/mentions")
@RequiredArgsConstructor
public class MentionController {
    
    private final MentionService mentionService;
    
    /**
     * Get all available usernames for mention autocomplete.
     */
    @GetMapping("/users")
    public ResponseEntity<List<String>> getAllUsernames() {
        return ResponseEntity.ok(mentionService.getAllUsernames());
    }
    
    /**
     * Search usernames by prefix for mention autocomplete.
     */
    @GetMapping("/users/search")
    public ResponseEntity<List<String>> searchUsernames(@RequestParam String prefix) {
        return ResponseEntity.ok(mentionService.searchUsernames(prefix));
    }
    
    /**
     * Get available mention targets (special mentions like @everyone, @here).
     */
    @GetMapping("/targets")
    public ResponseEntity<List<Map<String, String>>> getMentionTargets() {
        return ResponseEntity.ok(List.of(
                Map.of("name", "everyone", "description", "Notify all users"),
                Map.of("name", "here", "description", "Notify online users")
        ));
    }
}
