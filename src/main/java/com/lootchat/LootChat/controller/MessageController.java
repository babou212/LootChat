package com.lootchat.LootChat.controller;

import com.lootchat.LootChat.dto.CreateMessageRequest;
import com.lootchat.LootChat.dto.MessageResponse;
import com.lootchat.LootChat.dto.UpdateMessageRequest;
import com.lootchat.LootChat.entity.MessageDocument;
import com.lootchat.LootChat.service.MessageSearchService;
import com.lootchat.LootChat.service.MessageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/messages")
@RequiredArgsConstructor
@CrossOrigin(origins = "*", allowedHeaders = "*")
public class MessageController {

    private final MessageService messageService;
    private final MessageSearchService messageSearchService;

    @PostMapping
    public ResponseEntity<MessageResponse> createMessage(@RequestBody CreateMessageRequest request) {
        MessageResponse message;
        if (request.getChannelId() != null) {
            message = messageService.createMessage(request.getContent(), request.getChannelId(), request.getReplyToMessageId());
        } else {
            message = messageService.createMessage(request.getContent());
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(message);
    }

    @PostMapping("/upload")
    public ResponseEntity<MessageResponse> createMessageWithImage(
            @RequestParam("channelId") Long channelId,
            @RequestParam(value = "content", required = false) String content,
            @RequestParam("image") MultipartFile image,
            @RequestParam(value = "replyToMessageId", required = false) Long replyToMessageId) {
        MessageResponse message = messageService.createMessageWithImage(content, channelId, image, replyToMessageId);
        return ResponseEntity.status(HttpStatus.CREATED).body(message);
    }

    @GetMapping
    public ResponseEntity<List<MessageResponse>> getAllMessages(
            @RequestParam(required = false) Long channelId,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        List<MessageResponse> messages;
        if (channelId != null && page != null && size != null) {
            messages = messageService.getMessagesByChannelIdPaginated(channelId, page, size);
        } else if (channelId != null) {
            messages = messageService.getMessagesByChannelId(channelId);
        } else {
            messages = messageService.getAllMessages();
        }
        return ResponseEntity.ok(messages);
    }

    @GetMapping("/{id}")
    public ResponseEntity<MessageResponse> getMessageById(@PathVariable Long id) {
        MessageResponse message = messageService.getMessageById(id);
        return ResponseEntity.ok(message);
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<MessageResponse>> getMessagesByUserId(@PathVariable Long userId) {
        List<MessageResponse> messages = messageService.getMessagesForCurrentUser();
        return ResponseEntity.ok(messages);
    }

    @GetMapping("/search")
    public ResponseEntity<List<MessageDocument>> searchMessages(
            @RequestParam String query,
            @RequestParam(required = false) String  channelName,
            @RequestParam(required = false) String  username,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        List<MessageDocument> results;

        if (channelName != null) {
            results = messageSearchService.searchMessagesInChannel(channelName, query, page, size);
        } else if (username != null) {
            results = messageSearchService.searchMessagesByUser(username, query, page, size);
        } else {
            results = messageSearchService.searchAllMessages(query, page, size);
        }

        return ResponseEntity.ok(results);
    }

    @PutMapping("/{id}")
    public ResponseEntity<MessageResponse> updateMessage(
            @PathVariable Long id,
            @RequestBody UpdateMessageRequest request) {
        MessageResponse message = messageService.updateMessage(id, request.getContent());
        return ResponseEntity.ok(message);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteMessage(@PathVariable Long id) {
        messageService.deleteMessage(id);
        return ResponseEntity.noContent().build();
    }
}
