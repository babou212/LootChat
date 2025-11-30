import { defineStore } from 'pinia'
import { ConnectionState } from 'livekit-client'
import type { Room, ConnectionQuality } from 'livekit-client'

export interface LiveKitParticipant {
  odod: string
  username: string
  avatar?: string
  isMuted: boolean
  isSpeaking: boolean
  isScreenSharing: boolean
}

export interface ScreenShareInfo {
  odod: string
  sharerUsername: string
  // Store track as unknown to avoid complex type inference issues with Nuxt auto-imports
  track?: unknown
}

// We store the Room instance outside of reactive state to avoid type inference issues
let _roomInstance: Room | null = null

export function getRoomInstance(): Room | null {
  return _roomInstance
}

export function setRoomInstance(room: Room | null): void {
  _roomInstance = room
}

export const useLiveKitStore = defineStore('livekit', {
  state: () => ({
    // Room connection - store as boolean, actual instance accessed via getRoomInstance()
    hasRoom: false,
    connectionState: ConnectionState.Disconnected as ConnectionState,

    // Channel info
    currentChannelId: null as number | null,
    currentChannelName: null as string | null,

    // Participants
    participants: [] as LiveKitParticipant[],

    // Local state
    isMuted: false,
    isDeafened: false,
    isScreenSharing: false,

    // Screen shares from other participants
    activeScreenShares: [] as ScreenShareInfo[],

    // Connection quality per participant
    connectionQualityMap: {} as Record<string, ConnectionQuality>
  }),

  getters: {
    room: (): Room | null => {
      return _roomInstance
    },

    localParticipant: () => {
      return _roomInstance?.localParticipant || null
    },

    isConnected: (state): boolean => {
      return state.connectionState === ConnectionState.Connected
    },

    isConnecting: (state): boolean => {
      return state.connectionState === ConnectionState.Connecting
    },

    participantCount: (state): number => {
      return state.participants.length
    },

    hasActiveScreenShare: (state): boolean => {
      return state.activeScreenShares.length > 0
    },

    currentScreenShare: (state): ScreenShareInfo | null => {
      return state.activeScreenShares[0] || null
    },

    connectionQuality: state => (participantId: string): ConnectionQuality | undefined => {
      return state.connectionQualityMap[participantId]
    }
  },

  actions: {
    setRoom(room: Room | null) {
      setRoomInstance(room)
      this.hasRoom = room !== null
    },

    setConnectionState(state: ConnectionState) {
      this.connectionState = state
    },

    setCurrentChannel(channelId: number | null, channelName?: string) {
      this.currentChannelId = channelId
      this.currentChannelName = channelName || null
    },

    addParticipant(participant: LiveKitParticipant) {
      const exists = this.participants.find(p => p.odod === participant.odod)
      if (!exists) {
        this.participants.push(participant)
      }
    },

    removeParticipant(odod: string) {
      this.participants = this.participants.filter(p => p.odod !== odod)
      // Also remove any screen shares from this participant
      this.activeScreenShares = this.activeScreenShares.filter(s => s.odod !== odod)
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete this.connectionQualityMap[odod]
    },

    updateParticipantMuted(odod: string, isMuted: boolean) {
      const participant = this.participants.find(p => p.odod === odod)
      if (participant) {
        participant.isMuted = isMuted
      }
    },

    updateParticipantSpeaking(odod: string, isSpeaking: boolean) {
      const participant = this.participants.find(p => p.odod === odod)
      if (participant) {
        participant.isSpeaking = isSpeaking
      }
    },

    updateParticipantScreenSharing(odod: string, isScreenSharing: boolean) {
      const participant = this.participants.find(p => p.odod === odod)
      if (participant) {
        participant.isScreenSharing = isScreenSharing
      }
    },

    setMuted(isMuted: boolean) {
      this.isMuted = isMuted
    },

    setDeafened(isDeafened: boolean) {
      this.isDeafened = isDeafened
    },

    setScreenSharing(isScreenSharing: boolean) {
      this.isScreenSharing = isScreenSharing
    },

    addActiveScreenShare(screenShare: ScreenShareInfo) {
      const exists = this.activeScreenShares.find(s => s.odod === screenShare.odod)
      if (!exists) {
        this.activeScreenShares.push(screenShare)
      } else {
        // Update existing
        exists.track = screenShare.track
      }
    },

    removeActiveScreenShare(odod: string) {
      this.activeScreenShares = this.activeScreenShares.filter(s => s.odod !== odod)
    },

    updateConnectionQuality(odod: string, quality: ConnectionQuality) {
      this.connectionQualityMap[odod] = quality
    },

    reset() {
      // Disconnect room if connected
      const room = getRoomInstance()
      if (room) {
        try {
          room.disconnect()
        } catch {
          // Ignore errors during cleanup
        }
      }

      // Reset all state
      setRoomInstance(null)
      this.hasRoom = false
      this.connectionState = ConnectionState.Disconnected
      this.currentChannelId = null
      this.currentChannelName = null
      this.participants = []
      this.isMuted = false
      this.isDeafened = false
      this.isScreenSharing = false
      this.activeScreenShares = []
      this.connectionQualityMap = {}
    }
  }
})
