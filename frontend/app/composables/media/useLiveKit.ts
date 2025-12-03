import {
  Room,
  RoomEvent,
  Track,
  ConnectionState
} from 'livekit-client'
import type {
  LocalParticipant,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  LocalTrackPublication,
  Participant,
  DisconnectReason,
  TrackPublication,
  ConnectionQuality
} from 'livekit-client'
import { useLiveKitStore, getRoomInstance } from '../../../stores/livekit'
import { useUsersStore } from '../../../stores/users'

/**
 * Composable for LiveKit voice chat and screen sharing.
 * Uses LiveKit SFU (Selective Forwarding Unit) for reliable multi-user voice channels.
 */
export const useLiveKit = () => {
  const { user } = useAuth()
  const store = useLiveKitStore()
  const usersStore = useUsersStore()

  // Computed properties from store
  const room = computed(() => store.room)
  const connectionState = computed(() => store.connectionState)
  const participants = computed(() => store.participants)
  const localParticipant = computed(() => store.localParticipant)
  const isMuted = computed(() => store.isMuted)
  const isDeafened = computed(() => store.isDeafened)
  const isScreenSharing = computed(() => store.isScreenSharing)
  const activeScreenShares = computed(() => store.activeScreenShares)
  const currentChannelId = computed(() => store.currentChannelId)
  const currentChannelName = computed(() => store.currentChannelName)
  const connectionQuality = computed(() => store.connectionQuality)

  /**
   * Join a voice channel using LiveKit
   */
  const joinVoiceChannel = async (channelId: number, channelName?: string) => {
    if (!user.value) {
      throw new Error('User not authenticated')
    }

    // Leave current channel if in one
    if (store.currentChannelId !== null && store.currentChannelId !== channelId) {
      await leaveVoiceChannel()
    }

    try {
      // Get token from backend
      const tokenResponse = await $fetch<{
        token: string
        url: string
        roomName: string
        identity: string
      }>(`/api/livekit/token/${channelId}`, {
        method: 'POST'
      })

      console.log('[LiveKit] Got token for room:', tokenResponse.roomName)

      // Create new room instance
      const newRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
        // Audio settings for voice chat
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        // Video settings for screen sharing
        videoCaptureDefaults: {
          resolution: { width: 1920, height: 1080, frameRate: 60 }
        }
      })

      // Set up event handlers before connecting
      setupRoomEventHandlers(newRoom)

      // Connect to the room
      // For local development with LAN IP, no special config needed
      await newRoom.connect(tokenResponse.url, tokenResponse.token)

      console.log('[LiveKit] Connected to room:', newRoom.name)

      // Store room reference
      store.setRoom(newRoom)
      store.setCurrentChannel(channelId, channelName)

      // Enable microphone (will publish audio track)
      await newRoom.localParticipant.setMicrophoneEnabled(true)

      // Add self as participant
      store.addParticipant({
        odod: user.value.userId.toString(),
        username: user.value.username,
        avatar: user.value.avatar,
        isMuted: false,
        isSpeaking: false,
        isScreenSharing: false
      })

      // Initialize local participant's connection quality
      store.updateConnectionQuality(
        user.value.userId.toString(),
        newRoom.localParticipant.connectionQuality
      )

      console.log('[LiveKit] Checking existing participants:', newRoom.remoteParticipants.size)
      for (const [identity, participant] of newRoom.remoteParticipants) {
        console.log('[LiveKit] Found existing participant:', identity)
        handleParticipantConnected(participant)

        // Check for any existing screen share tracks that are already subscribed
        for (const pub of participant.videoTrackPublications.values()) {
          if (pub.source === Track.Source.ScreenShare && pub.track) {
            console.log('[LiveKit] Found existing screen share from', identity)
            store.addActiveScreenShare({
              odod: identity,
              sharerUsername: participant.name || identity,
              track: pub.track
            })
          }
        }
      }

      console.log('[LiveKit] Successfully joined voice channel', channelId)
    } catch (error) {
      console.error('[LiveKit] Error joining voice channel:', error)
      throw error
    }
  }

  /**
   * Leave the current voice channel
   */
  const leaveVoiceChannel = async () => {
    const roomInstance = getRoomInstance()
    if (!roomInstance) return

    try {
      console.log('[LiveKit] Leaving voice channel')

      // Stop screen share if active
      if (store.isScreenSharing) {
        await stopScreenShare()
      }

      // Disable microphone to fully release the audio track
      try {
        await roomInstance.localParticipant.setMicrophoneEnabled(false)
        console.log('[LiveKit] Microphone disabled')
      } catch (micError) {
        console.warn('[LiveKit] Error disabling microphone:', micError)
      }

      // Disconnect from room (this also unpublishes all tracks)
      await roomInstance.disconnect()

      // Reset store state
      store.reset()

      console.log('[LiveKit] Successfully left voice channel')
    } catch (error) {
      console.error('[LiveKit] Error leaving voice channel:', error)
      // Still reset state on error
      store.reset()
    }
  }

  /**
   * Toggle microphone mute state
   */
  const toggleMute = async () => {
    const roomInstance = getRoomInstance()
    if (!roomInstance) {
      console.warn('[LiveKit] Cannot toggle mute - no room instance')
      return
    }

    const newMuted = !store.isMuted
    console.log('[LiveKit] Toggling mute from', store.isMuted, 'to', newMuted)

    try {
      // Update store state first for responsive UI
      store.setMuted(newMuted)
      if (user.value) {
        store.updateParticipantMuted(user.value.userId.toString(), newMuted)
      }

      // Then update LiveKit (setMicrophoneEnabled(true) = unmuted, false = muted)
      await roomInstance.localParticipant.setMicrophoneEnabled(!newMuted)

      console.log('[LiveKit] Mute toggled successfully:', newMuted)
    } catch (error) {
      console.error('[LiveKit] Error toggling mute:', error)
      // Revert state on error
      store.setMuted(!newMuted)
      if (user.value) {
        store.updateParticipantMuted(user.value.userId.toString(), !newMuted)
      }
    }
  }

  /**
   * Toggle deafen state (mutes all incoming audio)
   */
  const toggleDeafen = async () => {
    const roomInstance = getRoomInstance()
    const newDeafened = !store.isDeafened
    store.setDeafened(newDeafened)

    // Mute all remote audio tracks
    if (roomInstance) {
      for (const participant of roomInstance.remoteParticipants.values()) {
        for (const publication of participant.audioTrackPublications.values()) {
          if (publication.track) {
            publication.track.setMuted(newDeafened)
          }
        }
      }
    }

    // Auto-mute when deafening
    if (newDeafened && !store.isMuted) {
      await toggleMute()
    }

    console.log('[LiveKit] Deafen toggled:', newDeafened)
  }

  /**
   * Start screen sharing with optional configuration
   */
  const startScreenShare = async (options?: {
    resolution?: { width: number, height: number, frameRate: number }
    audio?: boolean
  }) => {
    const roomInstance = getRoomInstance()
    if (!roomInstance || !user.value) {
      console.warn('[LiveKit] Cannot start screen share - not in a room')
      return
    }

    if (store.isScreenSharing) {
      console.warn('[LiveKit] Already screen sharing')
      return
    }

    try {
      // Enable screen sharing with options
      await roomInstance.localParticipant.setScreenShareEnabled(true, {
        audio: options?.audio ?? true, // Include system audio if available
        resolution: options?.resolution,
        contentHint: 'detail' // Optimize for screen content
      })

      store.setScreenSharing(true)

      // Update participant state
      store.updateParticipantScreenSharing(user.value.userId.toString(), true)

      console.log('[LiveKit] Screen sharing started')
    } catch (error) {
      if ((error as Error).name === 'NotAllowedError') {
        console.log('[LiveKit] User cancelled screen share picker')
      } else {
        console.error('[LiveKit] Error starting screen share:', error)
        throw error
      }
    }
  }

  /**
   * Stop screen sharing
   */
  const stopScreenShare = async () => {
    const roomInstance = getRoomInstance()
    if (!roomInstance || !user.value) return

    if (!store.isScreenSharing) {
      console.debug('[LiveKit] Not currently screen sharing')
      return
    }

    try {
      await roomInstance.localParticipant.setScreenShareEnabled(false)
      store.setScreenSharing(false)
      store.updateParticipantScreenSharing(user.value.userId.toString(), false)

      console.log('[LiveKit] Screen sharing stopped')
    } catch (error) {
      console.error('[LiveKit] Error stopping screen share:', error)
    }
  }

  /**
   * Toggle screen sharing on/off
   */
  const toggleScreenShare = async () => {
    if (store.isScreenSharing) {
      await stopScreenShare()
    } else {
      await startScreenShare()
    }
  }

  /**
   * Set up event handlers for the room
   */
  const setupRoomEventHandlers = (room: Room) => {
    // Connection state changes
    room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
      console.log('[LiveKit] Connection state changed:', state)
      store.setConnectionState(state)
    })

    // Participant connected
    room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      console.log('[LiveKit] Participant connected:', participant.identity)
      handleParticipantConnected(participant)
    })

    // Participant disconnected
    room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      console.log('[LiveKit] Participant disconnected:', participant.identity)
      store.removeParticipant(participant.identity)
    })

    // Track subscribed (remote track available)
    room.on(RoomEvent.TrackSubscribed, (
      track: RemoteTrack,
      publication: RemoteTrackPublication,
      participant: RemoteParticipant
    ) => {
      console.log('[LiveKit] Track subscribed:', track.kind, 'source:', publication.source, 'from', participant.identity)
      handleTrackSubscribed(track, publication, participant)
    })

    // Track unsubscribed
    room.on(RoomEvent.TrackUnsubscribed, (
      track: RemoteTrack,
      publication: RemoteTrackPublication,
      participant: RemoteParticipant
    ) => {
      console.log('[LiveKit] Track unsubscribed:', track.kind, 'from', participant.identity)
      handleTrackUnsubscribed(track, publication, participant)
    })

    // Track published by remote participant
    room.on(RoomEvent.TrackPublished, (
      publication: RemoteTrackPublication,
      participant: RemoteParticipant
    ) => {
      console.log('[LiveKit] Remote track published:', publication.kind, 'source:', publication.source, 'from', participant.identity, 'subscribed:', publication.isSubscribed)
    })

    // Track muted
    room.on(RoomEvent.TrackMuted, (
      publication: TrackPublication,
      participant: Participant
    ) => {
      if (publication.kind === Track.Kind.Audio) {
        // Only update remote participants - local mute state is managed by toggleMute
        if (participant.identity !== user.value?.userId.toString()) {
          store.updateParticipantMuted(participant.identity, true)
        }
      }
    })

    // Track unmuted
    room.on(RoomEvent.TrackUnmuted, (
      publication: TrackPublication,
      participant: Participant
    ) => {
      if (publication.kind === Track.Kind.Audio) {
        // Only update remote participants - local mute state is managed by toggleMute
        if (participant.identity !== user.value?.userId.toString()) {
          store.updateParticipantMuted(participant.identity, false)
        }
      }
    })

    // Active speakers changed
    room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
      // Update speaking state for all participants
      console.log('[LiveKit] Active speakers changed:', speakers.map(s => s.identity), 'participants:', store.participants.map(p => p.odod))

      // First, set all participants to not speaking
      for (const p of store.participants) {
        store.updateParticipantSpeaking(p.odod, false)
      }

      // Then mark the active speakers
      for (const speaker of speakers) {
        console.log('[LiveKit] Speaker detected:', speaker.identity)
        store.updateParticipantSpeaking(speaker.identity, true)
      }
    })

    // Also listen to individual participant speaking changes for more reliability
    room.localParticipant.on('isSpeakingChanged', (speaking: boolean) => {
      console.log('[LiveKit] Local participant speaking changed:', speaking)
      if (user.value) {
        store.updateParticipantSpeaking(user.value.userId.toString(), speaking)
      }
    })

    // Connection quality changed
    room.on(RoomEvent.ConnectionQualityChanged, (
      quality: ConnectionQuality,
      participant: Participant
    ) => {
      store.updateConnectionQuality(participant.identity, quality)
    })

    // Disconnected
    room.on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
      console.log('[LiveKit] Disconnected from room, reason:', reason)
      store.reset()
    })

    // Local track published
    room.on(RoomEvent.LocalTrackPublished, (
      publication: LocalTrackPublication,
      _participant: LocalParticipant
    ) => {
      console.log('[LiveKit] Local track published:', publication.kind)

      // Update screen sharing state
      if (publication.source === Track.Source.ScreenShare) {
        store.setScreenSharing(true)
        if (user.value) {
          store.updateParticipantScreenSharing(user.value.userId.toString(), true)
        }
      }
    })

    // Local track unpublished
    room.on(RoomEvent.LocalTrackUnpublished, (
      publication: LocalTrackPublication,
      _participant: LocalParticipant
    ) => {
      console.log('[LiveKit] Local track unpublished:', publication.kind)

      // Update screen sharing state
      if (publication.source === Track.Source.ScreenShare) {
        store.setScreenSharing(false)
        if (user.value) {
          store.updateParticipantScreenSharing(user.value.userId.toString(), false)
        }
      }
    })
  }

  /**
   * Handle a remote participant connecting
   */
  const handleParticipantConnected = (participant: RemoteParticipant) => {
    console.log('[LiveKit] handleParticipantConnected:', participant.identity, {
      audioTracks: Array.from(participant.audioTrackPublications.values()).map(p => ({ source: p.source, subscribed: p.isSubscribed })),
      videoTracks: Array.from(participant.videoTrackPublications.values()).map(p => ({ source: p.source, subscribed: p.isSubscribed })),
      isScreenShareEnabled: participant.isScreenShareEnabled
    })

    // Check if they have an audio track published and if it's muted
    // Default to NOT muted - the TrackMuted event will update this if needed
    let isMuted = false
    for (const pub of participant.audioTrackPublications.values()) {
      if (pub.isMuted) {
        isMuted = true
        break
      }
    }

    // Look up the user's avatar from the users store
    const userId = parseInt(participant.identity, 10)
    const userInfo = !isNaN(userId) ? usersStore.getUserById(userId) : undefined

    store.addParticipant({
      odod: participant.identity,
      username: participant.name || participant.identity,
      avatar: userInfo?.avatar,
      isMuted,
      isSpeaking: participant.isSpeaking,
      isScreenSharing: participant.isScreenShareEnabled
    })

    // Initialize connection quality for this participant
    store.updateConnectionQuality(participant.identity, participant.connectionQuality)

    // Set up participant event handlers
    participant.on('trackMuted', (publication) => {
      if (publication.kind === Track.Kind.Audio) {
        store.updateParticipantMuted(participant.identity, true)
      }
    })

    participant.on('trackUnmuted', (publication) => {
      if (publication.kind === Track.Kind.Audio) {
        store.updateParticipantMuted(participant.identity, false)
      }
    })

    participant.on('isSpeakingChanged', (speaking) => {
      store.updateParticipantSpeaking(participant.identity, speaking)
    })

    // Listen for track published events from this participant
    participant.on('trackPublished', (publication) => {
      console.log('[LiveKit] Remote participant track published:', participant.identity, publication.source, publication.kind)
    })
  }

  /**
   * Handle a remote track being subscribed
   */
  const handleTrackSubscribed = (
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant
  ) => {
    // Handle audio tracks
    if (track.kind === Track.Kind.Audio) {
      // Attach audio track to audio element for playback
      const audioElement = track.attach()
      audioElement.id = `audio-${participant.identity}`
      document.body.appendChild(audioElement)

      // Apply deafen state
      if (store.isDeafened) {
        track.setMuted(true)
      }
    }

    // Handle video tracks (screen share)
    if (track.kind === Track.Kind.Video) {
      if (publication.source === Track.Source.ScreenShare) {
        console.log('[LiveKit] Screen share track received from', participant.identity, 'track:', track)
        store.addActiveScreenShare({
          odod: participant.identity,
          sharerUsername: participant.name || participant.identity,
          track
        })
        console.log('[LiveKit] activeScreenShares after add:', store.activeScreenShares)
      }
    }
  }

  /**
   * Handle a remote track being unsubscribed
   */
  const handleTrackUnsubscribed = (
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant
  ) => {
    // Detach audio element
    if (track.kind === Track.Kind.Audio) {
      track.detach().forEach(el => el.remove())
    }

    // Remove screen share
    if (track.kind === Track.Kind.Video && publication.source === Track.Source.ScreenShare) {
      store.removeActiveScreenShare(participant.identity)
    }
  }

  // NOTE: We intentionally do NOT call leaveVoiceChannel on component unmount here.
  // The composable is used by multiple components (VoiceChannelSection, AudioSettingsPanel,
  // ScreenShareSettingsPanel, etc.), and we don't want switching tabs or closing settings
  // to disconnect the user from the voice channel.
  // The main component (VoiceChannelSection) handles leaving via explicit user action.

  return {
    // State
    room: readonly(room),
    connectionState: readonly(connectionState),
    participants: readonly(participants),
    localParticipant: readonly(localParticipant),
    isMuted: readonly(isMuted),
    isDeafened: readonly(isDeafened),
    isScreenSharing: readonly(isScreenSharing),
    activeScreenShares: readonly(activeScreenShares),
    currentChannelId: readonly(currentChannelId),
    currentChannelName: readonly(currentChannelName),
    connectionQuality: readonly(connectionQuality),

    // Computed helpers
    isConnected: computed(() => store.connectionState === ConnectionState.Connected),
    isConnecting: computed(() => store.connectionState === ConnectionState.Connecting),
    hasActiveScreenShare: computed(() => store.activeScreenShares.length > 0),

    // Methods
    joinVoiceChannel,
    leaveVoiceChannel,
    toggleMute,
    toggleDeafen,
    startScreenShare,
    stopScreenShare,
    toggleScreenShare
  }
}
