package com.lootchat.LootChat.config;

import com.lootchat.LootChat.entity.Channel;
import com.lootchat.LootChat.entity.ChannelType;
import com.lootchat.LootChat.repository.ChannelRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final ChannelRepository channelRepository;

    @Override
    public void run(String... args) {
        initializeDefaultTextChannel();
        initializeDefaultVoiceChannel();
    }

    private void initializeDefaultTextChannel() {
        String defaultChannelName = "general";

        if (channelRepository.findByName(defaultChannelName).isEmpty()) {
            Channel generalChannel = Channel.builder()
                    .name(defaultChannelName)
                    .description("General chat for everyone")
                    .channelType(ChannelType.TEXT)
                    .build();

            channelRepository.save(generalChannel);
            log.info("Created default 'general' text channel");
        } else {
            log.info("Default 'general' text channel already exists");
        }
    }

    private void initializeDefaultVoiceChannel() {
        String defaultVoiceChannelName = "general-voice";

        if (channelRepository.findByName(defaultVoiceChannelName).isEmpty()) {
            Channel generalVoiceChannel = Channel.builder()
                    .name(defaultVoiceChannelName)
                    .description("General voice chat for everyone")
                    .channelType(ChannelType.VOICE)
                    .build();

            channelRepository.save(generalVoiceChannel);
            log.info("Created default 'general-voice' voice channel");
        } else {
            log.info("Default 'general-voice' voice channel already exists");
        }
    }
}
