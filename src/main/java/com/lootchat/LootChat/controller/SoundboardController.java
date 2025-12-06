package com.lootchat.LootChat.controller;

import com.lootchat.LootChat.dto.SoundboardSoundDTO;
import com.lootchat.LootChat.service.SoundboardService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/soundboard")
@RequiredArgsConstructor
public class SoundboardController {

    private final SoundboardService soundboardService;
    private final SimpMessagingTemplate messagingTemplate;

    @PostMapping("/sounds")
    public ResponseEntity<SoundboardSoundDTO> uploadSound(
            @RequestParam("name") String name,
            @RequestParam("durationMs") Integer durationMs,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        log.info("Upload soundboard sound request - name: {}, user: {}", 
                name, userDetails.getUsername());
        
        SoundboardSoundDTO sound = soundboardService.uploadSound(
                name, durationMs, file, userDetails.getUsername()
        );

        // Broadcast to all users about the new sound
        messagingTemplate.convertAndSend(
                "/topic/soundboard",
                Map.of("type", "SOUND_ADDED", "sound", sound)
        );

        return ResponseEntity.ok(sound);
    }

    @GetMapping("/sounds")
    public ResponseEntity<List<SoundboardSoundDTO>> getSounds() {
        List<SoundboardSoundDTO> sounds = soundboardService.getAllSounds();
        return ResponseEntity.ok(sounds);
    }

    @DeleteMapping("/sounds/{soundId}")
    public ResponseEntity<Void> deleteSound(
            @PathVariable Long soundId,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        log.info("Delete soundboard sound request - soundId: {}, user: {}", 
                soundId, userDetails.getUsername());
        
        soundboardService.deleteSound(soundId, userDetails.getUsername());

        return ResponseEntity.noContent().build();
    }

    @PostMapping("/channels/{channelId}/sounds/{soundId}/play")
    public ResponseEntity<Void> playSound(
            @PathVariable Long channelId,
            @PathVariable Long soundId,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        log.info("Play soundboard sound request - channel: {}, soundId: {}, user: {}",
                channelId, soundId, userDetails.getUsername());

        // Broadcast to all users in the voice channel to play the sound
        messagingTemplate.convertAndSend(
                "/topic/channels/" + channelId + "/soundboard",
                Map.of(
                        "type", "SOUND_PLAYED",
                        "soundId", soundId,
                        "userId", userDetails.getUsername()
                )
        );

        return ResponseEntity.ok().build();
    }

    @GetMapping("/sounds/url")
    public ResponseEntity<Map<String, String>> getPresignedUrl(@RequestParam String path) {
        String url = soundboardService.getPresignedUrl(path);
        return ResponseEntity.ok(Map.of("url", url, "fileName", path));
    }
}
