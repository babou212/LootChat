package com.lootchat.LootChat.controller.directmessage;

import com.lootchat.LootChat.dto.directmessage.*;
import com.lootchat.LootChat.dto.message.ReactionRequest;
import com.lootchat.LootChat.dto.message.UpdateMessageRequest;
import com.lootchat.LootChat.service.directmessage.DirectMessageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/direct-messages")
@RequiredArgsConstructor
public class DirectMessageController {
    
    private final DirectMessageService directMessageService;
    
    @GetMapping
    public ResponseEntity<List<DirectMessageResponse>> getAllDirectMessages() {
        return ResponseEntity.ok(directMessageService.getAllDirectMessages());
    }
    
    @PostMapping
    public ResponseEntity<DirectMessageResponse> createOrGetDirectMessage(@RequestBody CreateDirectMessageRequest request) {
        return ResponseEntity.ok(directMessageService.createOrGetDirectMessage(request.getRecipientId()));
    }
    
    @GetMapping("/{directMessageId}/messages")
    public ResponseEntity<List<DirectMessageMessageResponse>> getMessages(
            @PathVariable Long directMessageId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size) {
        return ResponseEntity.ok(directMessageService.getDirectMessages(directMessageId, page, size));
    }
    
    @PostMapping("/messages")
    public ResponseEntity<DirectMessageMessageResponse> sendMessage(@RequestBody SendDirectMessageRequest request) {
        return ResponseEntity.ok(directMessageService.sendMessage(request));
    }
    
    @PostMapping("/upload")
    public ResponseEntity<DirectMessageMessageResponse> sendMessageWithImage(
            @RequestParam("directMessageId") Long directMessageId,
            @RequestParam(value = "content", required = false) String content,
            @RequestParam("image") MultipartFile image,
            @RequestParam(value = "replyToMessageId", required = false) Long replyToMessageId,
            @RequestParam(value = "replyToUsername", required = false) String replyToUsername,
            @RequestParam(value = "replyToContent", required = false) String replyToContent) {
        return ResponseEntity.ok(directMessageService.sendMessageWithImage(
            content, directMessageId, image, replyToMessageId, replyToUsername, replyToContent));
    }
    
    @PostMapping("/{directMessageId}/mark-read")
    public ResponseEntity<Void> markAsRead(@PathVariable Long directMessageId) {
        directMessageService.markAsRead(directMessageId);
        return ResponseEntity.ok().build();
    }
    
    @PostMapping("/messages/{messageId}/reactions")
    public ResponseEntity<DirectMessageReactionResponse> addReaction(
            @PathVariable Long messageId,
            @RequestBody ReactionRequest request) {
        return ResponseEntity.ok(directMessageService.addReaction(messageId, request.getEmoji()));
    }
    
    @DeleteMapping("/messages/{messageId}/reactions")
    public ResponseEntity<Void> removeReaction(
            @PathVariable Long messageId,
            @RequestBody ReactionRequest request) {
        directMessageService.removeReaction(messageId, request.getEmoji());
        return ResponseEntity.ok().build();
    }
    
    @PutMapping("/messages/{messageId}")
    public ResponseEntity<DirectMessageMessageResponse> updateMessage(
            @PathVariable Long messageId,
            @RequestBody UpdateMessageRequest request) {
        return ResponseEntity.ok(directMessageService.updateMessage(messageId, request.getContent()));
    }
    
    @DeleteMapping("/messages/{messageId}")
    public ResponseEntity<Void> deleteMessage(@PathVariable Long messageId) {
        directMessageService.deleteMessage(messageId);
        return ResponseEntity.noContent().build();
    }
}
