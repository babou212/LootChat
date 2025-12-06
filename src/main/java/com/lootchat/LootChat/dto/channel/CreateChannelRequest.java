package com.lootchat.LootChat.dto.channel;

import com.lootchat.LootChat.entity.ChannelType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateChannelRequest {
    private String name;
    private String description;
    private ChannelType channelType;
}
