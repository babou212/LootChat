package com.lootchat.LootChat.controller;

import com.lootchat.LootChat.dto.ChannelResponse;
import com.lootchat.LootChat.dto.CreateChannelRequest;
import com.lootchat.LootChat.dto.UpdateChannelRequest;
import com.lootchat.LootChat.service.ChannelService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/channels")
@RequiredArgsConstructor
public class ChannelController {

    private final ChannelService channelService;

    @PostMapping
    public ResponseEntity<ChannelResponse> createChannel(@RequestBody CreateChannelRequest request) {
        ChannelResponse channel = channelService.createChannel(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(channel);
    }

    @GetMapping
    public ResponseEntity<List<ChannelResponse>> getAllChannels() {
        List<ChannelResponse> channels = channelService.getAllChannels();
        return ResponseEntity.ok(channels);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ChannelResponse> getChannelById(@PathVariable Long id) {
        ChannelResponse channel = channelService.getChannelById(id);
        return ResponseEntity.ok(channel);
    }

    @GetMapping("/name/{name}")
    public ResponseEntity<ChannelResponse> getChannelByName(@PathVariable String name) {
        ChannelResponse channel = channelService.getChannelByName(name);
        return ResponseEntity.ok(channel);
    }

    @PutMapping("/{id}")
    public ResponseEntity<ChannelResponse> updateChannel(
            @PathVariable Long id,
            @RequestBody UpdateChannelRequest request) {
        ChannelResponse channel = channelService.updateChannel(id, request);
        return ResponseEntity.ok(channel);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteChannel(@PathVariable Long id) {
        channelService.deleteChannel(id);
        return ResponseEntity.noContent().build();
    }
}
