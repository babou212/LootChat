package com.lootchat.LootChat.dto.channel;

import com.lootchat.LootChat.entity.ChannelType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChannelResponse {
    private Long id;
    private String name;
    private String description;
    private ChannelType channelType;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
