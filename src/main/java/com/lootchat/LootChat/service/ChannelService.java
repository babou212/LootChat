package com.lootchat.LootChat.service;

import com.lootchat.LootChat.dto.ChannelResponse;
import com.lootchat.LootChat.dto.CreateChannelRequest;
import com.lootchat.LootChat.dto.UpdateChannelRequest;
import com.lootchat.LootChat.entity.Channel;
import com.lootchat.LootChat.entity.ChannelType;
import com.lootchat.LootChat.repository.ChannelRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ChannelService {

    private final ChannelRepository channelRepository;

    @Transactional
    public ChannelResponse createChannel(CreateChannelRequest request) {
        // Check if channel with the same name already exists
        channelRepository.findByName(request.getName()).ifPresent(channel -> {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Channel with name '" + request.getName() + "' already exists");
        });

        Channel channel = Channel.builder()
                .name(request.getName())
                .description(request.getDescription())
                .channelType(request.getChannelType() != null ? request.getChannelType() : ChannelType.TEXT)
                .build();

        Channel savedChannel = channelRepository.save(channel);
        return mapToChannelResponse(savedChannel);
    }

    @Transactional(readOnly = true)
    public List<ChannelResponse> getAllChannels() {
        return channelRepository.findAllByOrderByNameAsc().stream()
                .map(this::mapToChannelResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ChannelResponse getChannelById(Long id) {
        Channel channel = channelRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Channel not found with id: " + id));
        return mapToChannelResponse(channel);
    }

    @Transactional(readOnly = true)
    public ChannelResponse getChannelByName(String name) {
        Channel channel = channelRepository.findByName(name)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Channel not found with name: " + name));
        return mapToChannelResponse(channel);
    }

    @Transactional
    public ChannelResponse updateChannel(Long id, UpdateChannelRequest request) {
        Channel channel = channelRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Channel not found with id: " + id));

        // Check if new name conflicts with existing channel
        if (request.getName() != null && !request.getName().equals(channel.getName())) {
            channelRepository.findByName(request.getName()).ifPresent(existingChannel -> {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Channel with name '" + request.getName() + "' already exists");
            });
            channel.setName(request.getName());
        }

        if (request.getDescription() != null) {
            channel.setDescription(request.getDescription());
        }

        if (request.getChannelType() != null) {
            channel.setChannelType(request.getChannelType());
        }

        Channel updatedChannel = channelRepository.save(channel);
        return mapToChannelResponse(updatedChannel);
    }

    @Transactional
    public void deleteChannel(Long id) {
        Channel channel = channelRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Channel not found with id: " + id));
        channelRepository.delete(channel);
    }

    private ChannelResponse mapToChannelResponse(Channel channel) {
        return ChannelResponse.builder()
                .id(channel.getId())
                .name(channel.getName())
                .description(channel.getDescription())
                .channelType(channel.getChannelType())
                .createdAt(channel.getCreatedAt())
                .updatedAt(channel.getUpdatedAt())
                .build();
    }
}
