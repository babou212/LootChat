package com.lootchat.LootChat.controller;

import com.lootchat.LootChat.dto.ChannelResponse;
import com.lootchat.LootChat.dto.CreateChannelRequest;
import com.lootchat.LootChat.dto.UnreadCountResponse;
import com.lootchat.LootChat.dto.UpdateChannelRequest;
import com.lootchat.LootChat.service.ChannelReadStateService;
import com.lootchat.LootChat.service.ChannelService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/channels")
@RequiredArgsConstructor
public class ChannelController {

    private final ChannelService channelService;
    private final ChannelReadStateService channelReadStateService;

    @PostMapping
    public ResponseEntity<ChannelResponse> createChannel(@RequestBody CreateChannelRequest request) {
        ChannelResponse channel = channelService.createChannel(request);
        // Initialize read states for the new channel for all users
        channelReadStateService.initializeReadStatesForChannel(channel.getId());
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
        // Clean up read states before deleting the channel
        channelReadStateService.deleteReadStatesForChannel(id);
        channelService.deleteChannel(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Mark a channel as read for the current user.
     * Updates the user's last read timestamp to now.
     */
    @PostMapping("/{id}/read")
    public ResponseEntity<Void> markChannelAsRead(@PathVariable Long id) {
        channelReadStateService.markChannelAsRead(id);
        return ResponseEntity.ok().build();
    }

    /**
     * Get unread message counts for all channels for the current user.
     * Returns a map of channelId -> unreadCount.
     */
    @GetMapping("/unread")
    public ResponseEntity<Map<Long, Integer>> getUnreadCounts() {
        Map<Long, Integer> unreadCounts = channelReadStateService.getUnreadCountsForCurrentUser();
        return ResponseEntity.ok(unreadCounts);
    }

    /**
     * Get unread message counts as a list of objects.
     * Alternative format for frontend consumption.
     */
    @GetMapping("/unread/list")
    public ResponseEntity<List<UnreadCountResponse>> getUnreadCountsList() {
        List<UnreadCountResponse> unreadCounts = channelReadStateService.getUnreadCountsAsList();
        return ResponseEntity.ok(unreadCounts);
    }

    /**
     * Get unread count for a specific channel.
     */
    @GetMapping("/{id}/unread")
    public ResponseEntity<Integer> getUnreadCountForChannel(@PathVariable Long id) {
        int unreadCount = channelReadStateService.getUnreadCountForChannel(id);
        return ResponseEntity.ok(unreadCount);
    }
}
