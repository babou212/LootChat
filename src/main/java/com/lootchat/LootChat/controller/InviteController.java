package com.lootchat.LootChat.controller;

import com.lootchat.LootChat.dto.*;
import com.lootchat.LootChat.service.InviteService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/invites")
@RequiredArgsConstructor
public class InviteController {

    private final InviteService inviteService;

    @Value("${app.public.base-url:http://localhost:3000}")
    private String publicBaseUrl;

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<InviteTokenCreateResponse> createInvite(@RequestBody CreateInviteTokenRequest request) {
        return ResponseEntity.ok(inviteService.createInvite(request, publicBaseUrl));
    }

    @GetMapping("/{token}")
    public ResponseEntity<InviteValidationResponse> validate(@PathVariable String token) {
        return ResponseEntity.ok(inviteService.validate(token));
    }

    @PostMapping("/{token}/register")
    public ResponseEntity<AuthResponse> register(@PathVariable String token, @RequestBody RegisterWithInviteRequest request) {
        return ResponseEntity.ok(inviteService.registerWithInvite(token, request));
    }
}
