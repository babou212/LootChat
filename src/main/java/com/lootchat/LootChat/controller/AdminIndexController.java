package com.lootchat.LootChat.controller;

import com.lootchat.LootChat.entity.Message;
import com.lootchat.LootChat.repository.MessageRepository;
import com.lootchat.LootChat.service.MessageSearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/index")
@RequiredArgsConstructor
public class AdminIndexController {
    private final MessageRepository messageRepository;
    private final MessageSearchService messageSearchService;

    @PostMapping("/reindex-messages")
    public ResponseEntity<String> reindexAllMessages() {
        List<Message> allMessages = messageRepository.findAll();
        messageSearchService.indexAllMessages(allMessages);
        return ResponseEntity.ok("Reindexed " + allMessages.size() + " messages");
    }
}
