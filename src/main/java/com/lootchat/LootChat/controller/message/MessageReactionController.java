package com.lootchat.LootChat.controller.message;

import com.lootchat.LootChat.dto.message.ReactionRequest;
import com.lootchat.LootChat.dto.message.ReactionResponse;
import com.lootchat.LootChat.service.message.MessageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/messages")
@RequiredArgsConstructor
public class MessageReactionController {

    private final MessageService messageService;

    @PostMapping("/{messageId}/reactions")
    public ResponseEntity<ReactionResponse> addReaction(
            @PathVariable Long messageId,
            @RequestBody ReactionRequest request) {
        ReactionResponse reaction = messageService.addReaction(messageId, request.getEmoji());
        return ResponseEntity.status(HttpStatus.CREATED).body(reaction);
    }

    @DeleteMapping("/{messageId}/reactions")
    public ResponseEntity<Void> removeReaction(
            @PathVariable Long messageId,
            @RequestBody ReactionRequest request) {
        messageService.removeReaction(messageId, request.getEmoji());
        return ResponseEntity.noContent().build();
    }
}
