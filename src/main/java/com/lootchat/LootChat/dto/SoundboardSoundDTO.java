package com.lootchat.LootChat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SoundboardSoundDTO {
    private Long id;
    private String name;
    private String fileUrl;
    private String fileName;
    private Integer durationMs;
    private Long fileSize;
    private Long userId;
    private String username;
    private LocalDateTime createdAt;
}
