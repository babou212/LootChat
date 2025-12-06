package com.lootchat.LootChat.service;

import com.lootchat.LootChat.dto.channel.ChannelResponse;
import com.lootchat.LootChat.dto.channel.CreateChannelRequest;
import com.lootchat.LootChat.dto.channel.UpdateChannelRequest;
import com.lootchat.LootChat.entity.Channel;
import com.lootchat.LootChat.entity.ChannelType;
import com.lootchat.LootChat.entity.Role;
import com.lootchat.LootChat.entity.User;
import com.lootchat.LootChat.repository.ChannelRepository;
import com.lootchat.LootChat.security.CurrentUserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("ChannelService Tests")
class ChannelServiceTest {

    @Mock
    private ChannelRepository channelRepository;

    @Mock
    private CurrentUserService currentUserService;

    @InjectMocks
    private ChannelService channelService;

    private User adminUser;
    private User regularUser;
    private Channel generalChannel;
    private Channel gamingChannel;

    @BeforeEach
    void setUp() {
        adminUser = User.builder()
                .id(1L)
                .username("admin")
                .email("admin@example.com")
                .role(Role.ADMIN)
                .build();

        regularUser = User.builder()
                .id(2L)
                .username("user")
                .email("user@example.com")
                .role(Role.USER)
                .build();

        generalChannel = Channel.builder()
                .id(1L)
                .name("general")
                .description("General discussion")
                .channelType(ChannelType.TEXT)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        gamingChannel = Channel.builder()
                .id(2L)
                .name("gaming")
                .description("Gaming discussions")
                .channelType(ChannelType.TEXT)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
    }

    @Test
    @DisplayName("createChannel should create channel when user is admin")
    void createChannel_ShouldCreateChannel_WhenUserIsAdmin() {
        CreateChannelRequest request = new CreateChannelRequest();
        request.setName("new-channel");
        request.setDescription("New channel description");
        request.setChannelType(ChannelType.TEXT);

        when(currentUserService.getCurrentUserOrThrow()).thenReturn(adminUser);
        when(channelRepository.findByName("new-channel")).thenReturn(Optional.empty());
        when(channelRepository.save(any(Channel.class))).thenAnswer(invocation -> {
            Channel channel = invocation.getArgument(0);
            channel.setId(3L);
            return channel;
        });

        ChannelResponse result = channelService.createChannel(request);

        assertThat(result).isNotNull();
        assertThat(result.getName()).isEqualTo("new-channel");
        assertThat(result.getDescription()).isEqualTo("New channel description");
        assertThat(result.getChannelType()).isEqualTo(ChannelType.TEXT);
        verify(channelRepository, times(1)).save(any(Channel.class));
    }

    @Test
    @DisplayName("createChannel should throw exception when user is not admin")
    void createChannel_ShouldThrowException_WhenUserIsNotAdmin() {
        CreateChannelRequest request = new CreateChannelRequest();
        request.setName("new-channel");

        when(currentUserService.getCurrentUserOrThrow()).thenReturn(regularUser);

        assertThatThrownBy(() -> channelService.createChannel(request))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Only admin users can create channels")
                .extracting("status")
                .isEqualTo(HttpStatus.FORBIDDEN);

        verify(channelRepository, never()).save(any());
    }

    @Test
    @DisplayName("createChannel should throw exception when channel name already exists")
    void createChannel_ShouldThrowException_WhenChannelNameExists() {
        CreateChannelRequest request = new CreateChannelRequest();
        request.setName("general");

        when(currentUserService.getCurrentUserOrThrow()).thenReturn(adminUser);
        when(channelRepository.findByName("general")).thenReturn(Optional.of(generalChannel));

        assertThatThrownBy(() -> channelService.createChannel(request))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Channel with name 'general' already exists")
                .extracting("status")
                .isEqualTo(HttpStatus.CONFLICT);

        verify(channelRepository, never()).save(any());
    }

    @Test
    @DisplayName("createChannel should use TEXT type as default when not specified")
    void createChannel_ShouldUseDefaultTextType_WhenNotSpecified() {
        CreateChannelRequest request = new CreateChannelRequest();
        request.setName("new-channel");
        request.setDescription("Description");

        when(currentUserService.getCurrentUserOrThrow()).thenReturn(adminUser);
        when(channelRepository.findByName("new-channel")).thenReturn(Optional.empty());
        when(channelRepository.save(any(Channel.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ChannelResponse result = channelService.createChannel(request);

        assertThat(result.getChannelType()).isEqualTo(ChannelType.TEXT);
    }

    @Test
    @DisplayName("getAllChannels should return all channels ordered by name")
    void getAllChannels_ShouldReturnAllChannels_OrderedByName() {
        when(channelRepository.findAllByOrderByNameAsc()).thenReturn(Arrays.asList(generalChannel, gamingChannel));

        List<ChannelResponse> result = channelService.getAllChannels();

        assertThat(result).hasSize(2);
        assertThat(result.get(0).getName()).isEqualTo("general");
        assertThat(result.get(1).getName()).isEqualTo("gaming");
        verify(channelRepository, times(1)).findAllByOrderByNameAsc();
    }

    @Test
    @DisplayName("getAllChannels should return empty list when no channels exist")
    void getAllChannels_ShouldReturnEmptyList_WhenNoChannels() {
        when(channelRepository.findAllByOrderByNameAsc()).thenReturn(List.of());

        List<ChannelResponse> result = channelService.getAllChannels();

        assertThat(result).isEmpty();
        verify(channelRepository, times(1)).findAllByOrderByNameAsc();
    }

    @Test
    @DisplayName("getChannelById should return channel when found")
    void getChannelById_ShouldReturnChannel_WhenFound() {
        when(channelRepository.findById(1L)).thenReturn(Optional.of(generalChannel));

        ChannelResponse result = channelService.getChannelById(1L);

        assertThat(result).isNotNull();
        assertThat(result.getId()).isEqualTo(1L);
        assertThat(result.getName()).isEqualTo("general");
        assertThat(result.getDescription()).isEqualTo("General discussion");
        verify(channelRepository, times(1)).findById(1L);
    }

    @Test
    @DisplayName("getChannelById should throw exception when channel not found")
    void getChannelById_ShouldThrowException_WhenNotFound() {
        when(channelRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> channelService.getChannelById(999L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Channel not found with id: 999")
                .extracting("status")
                .isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    @DisplayName("getChannelByName should return channel when found")
    void getChannelByName_ShouldReturnChannel_WhenFound() {
        when(channelRepository.findByName("general")).thenReturn(Optional.of(generalChannel));

        ChannelResponse result = channelService.getChannelByName("general");

        assertThat(result).isNotNull();
        assertThat(result.getName()).isEqualTo("general");
        assertThat(result.getDescription()).isEqualTo("General discussion");
        verify(channelRepository, times(1)).findByName("general");
    }

    @Test
    @DisplayName("getChannelByName should throw exception when channel not found")
    void getChannelByName_ShouldThrowException_WhenNotFound() {
        when(channelRepository.findByName("nonexistent")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> channelService.getChannelByName("nonexistent"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Channel not found with name: nonexistent")
                .extracting("status")
                .isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    @DisplayName("updateChannel should update channel successfully")
    void updateChannel_ShouldUpdateChannel_Successfully() {
        UpdateChannelRequest request = new UpdateChannelRequest();
        request.setName("updated-gaming");
        request.setDescription("Updated description");
        request.setChannelType(ChannelType.VOICE);

        when(channelRepository.findById(2L)).thenReturn(Optional.of(gamingChannel));
        when(channelRepository.findByName("updated-gaming")).thenReturn(Optional.empty());
        when(channelRepository.save(any(Channel.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ChannelResponse result = channelService.updateChannel(2L, request);

        assertThat(result.getName()).isEqualTo("updated-gaming");
        assertThat(result.getDescription()).isEqualTo("Updated description");
        assertThat(result.getChannelType()).isEqualTo(ChannelType.VOICE);
        verify(channelRepository, times(1)).save(gamingChannel);
    }

    @Test
    @DisplayName("updateChannel should throw exception when new name already exists")
    void updateChannel_ShouldThrowException_WhenNewNameExists() {
        UpdateChannelRequest request = new UpdateChannelRequest();
        request.setName("general");

        when(channelRepository.findById(2L)).thenReturn(Optional.of(gamingChannel));
        when(channelRepository.findByName("general")).thenReturn(Optional.of(generalChannel));

        assertThatThrownBy(() -> channelService.updateChannel(2L, request))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Channel with name 'general' already exists")
                .extracting("status")
                .isEqualTo(HttpStatus.CONFLICT);

        verify(channelRepository, never()).save(any());
    }

    @Test
    @DisplayName("updateChannel should allow updating to same name")
    void updateChannel_ShouldAllowSameName() {
        UpdateChannelRequest request = new UpdateChannelRequest();
        request.setName("gaming");
        request.setDescription("New description");

        when(channelRepository.findById(2L)).thenReturn(Optional.of(gamingChannel));
        when(channelRepository.save(any(Channel.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ChannelResponse result = channelService.updateChannel(2L, request);

        assertThat(result.getName()).isEqualTo("gaming");
        assertThat(result.getDescription()).isEqualTo("New description");
        verify(channelRepository, times(1)).save(gamingChannel);
        verify(channelRepository, never()).findByName(any()); // Should not check for name conflicts
    }

    @Test
    @DisplayName("deleteChannel should delete channel when user is admin")
    void deleteChannel_ShouldDeleteChannel_WhenUserIsAdmin() {
        when(channelRepository.findById(2L)).thenReturn(Optional.of(gamingChannel));
        when(currentUserService.getCurrentUserOrThrow()).thenReturn(adminUser);

        channelService.deleteChannel(2L);

        verify(channelRepository, times(1)).delete(gamingChannel);
    }

    @Test
    @DisplayName("deleteChannel should throw exception when user is not admin")
    void deleteChannel_ShouldThrowException_WhenUserIsNotAdmin() {
        when(channelRepository.findById(2L)).thenReturn(Optional.of(gamingChannel));
        when(currentUserService.getCurrentUserOrThrow()).thenReturn(regularUser);

        assertThatThrownBy(() -> channelService.deleteChannel(2L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Only admin users can delete channels")
                .extracting("status")
                .isEqualTo(HttpStatus.FORBIDDEN);

        verify(channelRepository, never()).delete(any());
    }

    @Test
    @DisplayName("deleteChannel should throw exception when trying to delete general channel")
    void deleteChannel_ShouldThrowException_WhenDeletingGeneralChannel() {
        when(channelRepository.findById(1L)).thenReturn(Optional.of(generalChannel));
        when(currentUserService.getCurrentUserOrThrow()).thenReturn(adminUser);

        assertThatThrownBy(() -> channelService.deleteChannel(1L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("The 'general' channel cannot be deleted")
                .extracting("status")
                .isEqualTo(HttpStatus.FORBIDDEN);

        verify(channelRepository, never()).delete(any());
    }

    @Test
    @DisplayName("deleteChannel should throw exception when trying to delete general-voice channel")
    void deleteChannel_ShouldThrowException_WhenDeletingGeneralVoiceChannel() {
        Channel generalVoice = Channel.builder()
                .id(3L)
                .name("general-voice")
                .channelType(ChannelType.VOICE)
                .build();

        when(channelRepository.findById(3L)).thenReturn(Optional.of(generalVoice));
        when(currentUserService.getCurrentUserOrThrow()).thenReturn(adminUser);

        assertThatThrownBy(() -> channelService.deleteChannel(3L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("The 'general-voice' channel cannot be deleted")
                .extracting("status")
                .isEqualTo(HttpStatus.FORBIDDEN);

        verify(channelRepository, never()).delete(any());
    }

    @Test
    @DisplayName("deleteChannel should throw exception when channel not found")
    void deleteChannel_ShouldThrowException_WhenChannelNotFound() {
        when(channelRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> channelService.deleteChannel(999L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Channel not found with id: 999")
                .extracting("status")
                .isEqualTo(HttpStatus.NOT_FOUND);

        verify(channelRepository, never()).delete(any());
    }
}
