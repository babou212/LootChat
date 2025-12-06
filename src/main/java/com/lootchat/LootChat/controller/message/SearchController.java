package com.lootchat.LootChat.controller.message;

import com.lootchat.LootChat.dto.message.MessageSearchResponse;
import com.lootchat.LootChat.service.message.MessageSearchService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/search")
@RequiredArgsConstructor
public class SearchController {
    
    private final MessageSearchService searchService;
    
    @GetMapping("/messages")
    public ResponseEntity<MessageSearchResponse> searchMessages(
            @RequestParam String query,
            @RequestParam(required = false) Long channelId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication authentication) {
        
        log.debug("Search request: query='{}', channelId={}, page={}, size={}", 
                query, channelId, page, size);
        
        MessageSearchResponse response;
        if (channelId != null) {
            response = searchService.searchChannelMessages(channelId, query, page, size);
        } else {
            response = searchService.searchAllMessages(query, page, size);
        }
        
        return ResponseEntity.ok(response);
    }
    
    @PostMapping("/reindex")
    public ResponseEntity<String> reindexMessages(Authentication authentication) {
        log.info("Reindex request from user: {}", authentication.getName());
        searchService.reindexAllMessages();
        return ResponseEntity.ok("Reindexing started");
    }
}
