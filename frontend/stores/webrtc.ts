import { defineStore } from 'pinia'
import type { StompSubscription } from '@stomp/stompjs'
import type { VoiceParticipant, ScreenShareInfo } from '../shared/types/chat'

/**
 * Enhanced WebRTC Store - Centralized voice channel management
 *
 * Features:
 * - Centralized state management with Pinia
 * - Connection quality monitoring
 * - Automatic cleanup and resource management
 * - Audio analysis for speaking detection
 * - Peer connection tracking
 */

export interface PeerConnection {
  connection: RTCPeerConnection
  stream?: MediaStream
  audioEl?: HTMLAudioElement
  analyser?: AnalyserNode
  audioContext?: AudioContext
}

export interface ConnectionQualityMetrics {
  quality: 'excellent' | 'good' | 'poor' | 'disconnected'
  rtt?: number // Round trip time in seconds
  packetsLost?: number
  jitter?: number
  bitrate?: number
  lastUpdated: Date
}

export type AudioProfile = 'balanced' | 'high-quality' | 'bandwidth-saving' | 'noise-canceling'

export interface AudioConstraints {
  echoCancellation: boolean
  noiseSuppression: boolean | { ideal: boolean }
  autoGainControl: boolean
  sampleRate: number
  channelCount: number
  latency?: number
  sampleSize?: number
}

export const AUDIO_PROFILES: Record<AudioProfile, AudioConstraints> = {
  'balanced': {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 48000,
    channelCount: 1, // Mono for bandwidth efficiency
    latency: 0.01 // 10ms - balanced latency
  },
  'high-quality': {
    echoCancellation: true,
    noiseSuppression: { ideal: true },
    autoGainControl: true,
    sampleRate: 48000,
    channelCount: 2, // Stereo for quality
    latency: 0.02, // 20ms - higher latency for quality
    sampleSize: 16
  },
  'bandwidth-saving': {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 24000, // Lower sample rate
    channelCount: 1, // Mono
    latency: 0.015 // 15ms
  },
  'noise-canceling': {
    echoCancellation: true,
    noiseSuppression: { ideal: true }, // Maximum noise suppression
    autoGainControl: true,
    sampleRate: 48000,
    channelCount: 1,
    latency: 0.025 // 25ms - higher latency for better processing
  }
}

export interface PeerConnectionState {
  userId: string
  signalingState: RTCSignalingState
  iceConnectionState: RTCIceConnectionState
  connectionState: RTCPeerConnectionState
  iceGatheringState: RTCIceGatheringState
}

/**
 * Screen share quality profiles
 * Different presets for various use cases
 */
export type ScreenShareQuality = 'source' | '1080p60' | '1080p30' | '720p60' | '720p30' | '480p30'

export interface ScreenShareSettings {
  width: number
  height: number
  frameRate: number
  maxBitrate: number // in kbps
  label: string
  description: string
}

export const SCREEN_SHARE_PROFILES: Record<ScreenShareQuality, ScreenShareSettings> = {
  'source': {
    width: 0, // 0 means use source resolution
    height: 0,
    frameRate: 60,
    maxBitrate: 8000,
    label: 'Source Quality',
    description: 'Native resolution up to 60fps (highest bandwidth)'
  },
  '1080p60': {
    width: 1920,
    height: 1080,
    frameRate: 60,
    maxBitrate: 6000,
    label: '1080p 60fps',
    description: 'Full HD at 60fps (high bandwidth)'
  },
  '1080p30': {
    width: 1920,
    height: 1080,
    frameRate: 30,
    maxBitrate: 4000,
    label: '1080p 30fps',
    description: 'Full HD at 30fps (balanced)'
  },
  '720p60': {
    width: 1280,
    height: 720,
    frameRate: 60,
    maxBitrate: 3000,
    label: '720p 60fps',
    description: 'HD at 60fps (good for gaming)'
  },
  '720p30': {
    width: 1280,
    height: 720,
    frameRate: 30,
    maxBitrate: 2000,
    label: '720p 30fps',
    description: 'HD at 30fps (lower bandwidth)'
  },
  '480p30': {
    width: 854,
    height: 480,
    frameRate: 30,
    maxBitrate: 1000,
    label: '480p 30fps',
    description: 'SD quality (minimal bandwidth)'
  }
}

export const useWebRTCStore = defineStore('webrtc', {
  state: () => {
    let initialProfile: AudioProfile = 'balanced'
    let initialDevice: string | null = null
    let initialScreenShareQuality: ScreenShareQuality = '1080p30'

    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('lootchat_audio_preferences')
        if (stored) {
          const prefs = JSON.parse(stored)
          if (prefs.profile) initialProfile = prefs.profile
          if (prefs.deviceId !== undefined) initialDevice = prefs.deviceId
        }
      } catch (error) {
        console.warn('Failed to load audio preferences:', error)
      }

      try {
        const storedScreenShare = localStorage.getItem('lootchat_screenshare_preferences')
        if (storedScreenShare) {
          const prefs = JSON.parse(storedScreenShare)
          // Validate that the stored quality is a valid profile key
          if (prefs.quality && SCREEN_SHARE_PROFILES[prefs.quality as ScreenShareQuality]) {
            initialScreenShareQuality = prefs.quality
          }
        }
      } catch (error) {
        console.warn('Failed to load screen share preferences:', error)
      }
    }

    return {
      localStream: null as MediaStream | null,

      peers: new Map<string, PeerConnection>(),
      pendingCandidates: new Map<string, RTCIceCandidateInit[]>(),

      participants: [] as VoiceParticipant[],

      isMuted: false,
      isDeafened: false,

      // Screen sharing state
      isScreenSharing: false,
      screenStream: null as MediaStream | null,
      activeScreenShares: [] as ScreenShareInfo[],
      screenSharePeers: new Map<string, { connection: RTCPeerConnection, stream?: MediaStream }>(),
      screenShareQuality: initialScreenShareQuality,

      audioProfile: initialProfile,
      selectedAudioDevice: initialDevice,
      availableAudioDevices: [] as MediaDeviceInfo[],

      currentChannelId: null as number | null,
      currentChannelName: null as string | null,

      channelWebRTCSub: null as StompSubscription | null,
      userSignalSub: null as StompSubscription | null,

      localAnalyser: null as AnalyserNode | null,
      localAudioContext: null as AudioContext | null,
      speakingCheckFrameId: null as number | null,

      connectionQuality: new Map<string, ConnectionQualityMetrics>(),
      qualityMonitorInterval: null as ReturnType<typeof setInterval> | null,

      speakingThreshold: -35, // dB threshold for voice detection
      qualityCheckInterval: 5000, // Check quality every 5 seconds

      beforeUnloadHandler: null as ((e: BeforeUnloadEvent) => void) | null,
      stompHandlersBound: false,

      connectionErrors: new Map<string, { error: string, timestamp: Date, retries: number }>()
    }
  },

  getters: {
    isInVoiceChannel: state => state.currentChannelId !== null,

    participantCount: state => state.participants.length,

    activePeerConnections: state => state.peers.size,

    connectedPeers: (state) => {
      return Array.from(state.peers.entries())
        .filter(([_, peer]) =>
          peer.connection.connectionState === 'connected'
          || peer.connection.iceConnectionState === 'connected'
          || peer.connection.iceConnectionState === 'completed'
        )
        .map(([userId]) => userId)
    },

    averageConnectionQuality: (state) => {
      const qualities = Array.from(state.connectionQuality.values())
      if (qualities.length === 0) return 'disconnected'

      const scores = qualities.map(q =>
        q.quality === 'excellent'
          ? 3
          : q.quality === 'good'
            ? 2
            : q.quality === 'poor' ? 1 : 0
      )

      const avg = scores.reduce((a: number, b: number): number => a + b, 0) / scores.length

      if (avg >= 2.5) return 'excellent'
      if (avg >= 1.5) return 'good'
      if (avg >= 0.5) return 'poor'
      return 'disconnected'
    },

    peerConnectionStates: (state): PeerConnectionState[] => {
      return Array.from(state.peers.entries()).map(([userId, peer]) => ({
        userId,
        signalingState: peer.connection.signalingState,
        iceConnectionState: peer.connection.iceConnectionState,
        connectionState: peer.connection.connectionState,
        iceGatheringState: peer.connection.iceGatheringState
      }))
    },

    hasErrors: state => state.connectionErrors.size > 0,

    localStreamActive: (state) => {
      if (!state.localStream) return false
      return state.localStream.getTracks().some(track => track.enabled && track.readyState === 'live')
    },

    /**
     * Check if someone is currently sharing their screen
     */
    hasActiveScreenShare: state => state.activeScreenShares.length > 0,

    /**
     * Get the current screen share (first one if multiple)
     */
    currentScreenShare: state => state.activeScreenShares[0] || null,

    /**
     * Get all active screen shares
     */
    allScreenShares: state => state.activeScreenShares,

    /**
     * Check if a specific user is screen sharing
     */
    isUserScreenSharing: state => (userId: string) => {
      return state.activeScreenShares.some(share => share.sharerId === userId)
    },

    /**
     * Get current screen share video constraints based on quality setting
     */
    currentScreenShareConstraints: (state): DisplayMediaStreamOptions => {
      const profile = SCREEN_SHARE_PROFILES[state.screenShareQuality] || SCREEN_SHARE_PROFILES['1080p30']

      // Build video constraints - DisplayMediaStreamOptions uses different types
      const videoConstraints: Record<string, unknown> = {
        cursor: 'always',
        frameRate: { ideal: profile.frameRate, max: profile.frameRate }
      }

      // Only set resolution constraints if not 'source' quality
      if (profile.width > 0 && profile.height > 0) {
        videoConstraints.width = { ideal: profile.width, max: profile.width }
        videoConstraints.height = { ideal: profile.height, max: profile.height }
      }

      return {
        video: videoConstraints as MediaTrackConstraints,
        audio: {
          // System audio for screen share (games, videos, etc.)
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      }
    },

    /**
     * Get current screen share settings info
     */
    currentScreenShareSettings: (state): ScreenShareSettings => {
      return SCREEN_SHARE_PROFILES[state.screenShareQuality] || SCREEN_SHARE_PROFILES['1080p30']
    },

    currentAudioConstraints: (state): MediaTrackConstraints => {
      const profile = AUDIO_PROFILES[state.audioProfile]
      const constraints: MediaTrackConstraints = {
        echoCancellation: profile.echoCancellation,
        noiseSuppression: profile.noiseSuppression,
        autoGainControl: profile.autoGainControl,
        sampleRate: profile.sampleRate,
        channelCount: profile.channelCount
      }

      if (profile.sampleSize) {
        constraints.sampleSize = profile.sampleSize
      }

      if (state.selectedAudioDevice) {
        constraints.deviceId = { exact: state.selectedAudioDevice }
      }

      return constraints
    },

    audioDevicesAvailable: state => state.availableAudioDevices.length > 0,

    /**
     * Get detailed audio quality metrics for a specific peer
     */
    getPeerQualityMetrics: state => (userId: string) => {
      return state.connectionQuality.get(userId)
    },

    /**
     * Get audio quality summary across all peers
     */
    audioQualitySummary: (state) => {
      const metrics = Array.from(state.connectionQuality.values())
      if (metrics.length === 0) {
        return {
          avgRtt: 0,
          avgPacketLoss: 0,
          avgJitter: 0,
          avgBitrate: 0,
          quality: 'disconnected' as const
        }
      }

      const sum = metrics.reduce((acc, m) => ({
        rtt: acc.rtt + (m.rtt || 0),
        packetsLost: acc.packetsLost + (m.packetsLost || 0),
        jitter: acc.jitter + (m.jitter || 0),
        bitrate: acc.bitrate + (m.bitrate || 0)
      }), { rtt: 0, packetsLost: 0, jitter: 0, bitrate: 0 })

      const scores = metrics.map(m =>
        m.quality === 'excellent' ? 3 : m.quality === 'good' ? 2 : m.quality === 'poor' ? 1 : 0
      )
      const avg = scores.reduce((a: number, b: number): number => a + b, 0) / scores.length
      const quality = avg >= 2.5 ? 'excellent' : avg >= 1.5 ? 'good' : avg >= 0.5 ? 'poor' : 'disconnected'

      return {
        avgRtt: sum.rtt / metrics.length,
        avgPacketLoss: sum.packetsLost / metrics.length,
        avgJitter: sum.jitter / metrics.length,
        avgBitrate: sum.bitrate / metrics.length,
        quality: quality as 'excellent' | 'good' | 'poor' | 'disconnected'
      }
    }
  },

  actions: {
    /**
     * Add a peer connection
     */
    addPeer(userId: string, connection: RTCPeerConnection) {
      this.peers.set(userId, { connection })
    },

    /**
     * Update peer connection with stream and audio elements
     */
    updatePeer(userId: string, updates: Partial<PeerConnection>) {
      const existing = this.peers.get(userId)
      if (existing) {
        this.peers.set(userId, { ...existing, ...updates })
      }
    },

    /**
     * Remove and cleanup a peer connection
     */
    removePeer(userId: string) {
      const peer = this.peers.get(userId)
      if (!peer) return

      try {
        peer.connection.close()
      } catch (error) {
        console.warn(`Error closing peer connection for ${userId}:`, error)
      }

      if (peer.stream) {
        peer.stream.getTracks().forEach((track) => {
          track.stop()
          track.enabled = false
        })
      }

      if (peer.audioEl) {
        peer.audioEl.pause()
        peer.audioEl.srcObject = null
        peer.audioEl.remove()
      }

      // Disconnect analyser
      if (peer.analyser) {
        try {
          peer.analyser.disconnect()
        } catch {
          // Ignore disconnect errors
        }
      }

      // Close audio context
      if (peer.audioContext && peer.audioContext.state !== 'closed') {
        peer.audioContext.close().catch(() => {})
      }

      // Remove from maps
      this.peers.delete(userId)
      this.connectionQuality.delete(userId)
      this.pendingCandidates.delete(userId)
      this.connectionErrors.delete(userId)
    },

    /**
     * Add a participant to the voice channel
     */
    addParticipant(participant: VoiceParticipant) {
      const exists = this.participants.find(p => p.userId === participant.userId)
      if (!exists) {
        this.participants.push(participant)
      }
    },

    /**
     * Remove a participant from the voice channel
     */
    removeParticipant(userId: string) {
      this.participants = this.participants.filter(p => p.userId !== userId)
    },

    /**
     * Update participant speaking state
     */
    updateParticipantSpeaking(userId: string, isSpeaking: boolean) {
      const participant = this.participants.find(p => p.userId === userId)
      if (participant && participant.isSpeaking !== isSpeaking) {
        participant.isSpeaking = isSpeaking
      }
    },

    /**
     * Update participant muted state
     */
    updateParticipantMuted(userId: string, isMuted: boolean) {
      const participant = this.participants.find(p => p.userId === userId)
      if (participant) {
        participant.isMuted = isMuted
      }
    },

    /**
     * Update participant screen sharing state
     */
    updateParticipantScreenSharing(userId: string, isScreenSharing: boolean) {
      const participant = this.participants.find(p => p.userId === userId)
      if (participant) {
        participant.isScreenSharing = isScreenSharing
      }
    },

    /**
     * Set screen stream (local)
     */
    setScreenStream(stream: MediaStream | null) {
      // Cleanup old stream
      if (this.screenStream && stream !== this.screenStream) {
        this.screenStream.getTracks().forEach(track => track.stop())
      }
      this.screenStream = stream
      this.isScreenSharing = stream !== null
    },

    /**
     * Add an active screen share from a remote user
     */
    addActiveScreenShare(info: ScreenShareInfo) {
      const exists = this.activeScreenShares.find(s => s.sharerId === info.sharerId)
      if (!exists) {
        this.activeScreenShares.push(info)
        this.updateParticipantScreenSharing(info.sharerId, true)
      } else {
        // Update existing with new stream
        exists.stream = info.stream
      }
    },

    /**
     * Remove an active screen share
     */
    removeActiveScreenShare(sharerId: string) {
      const share = this.activeScreenShares.find(s => s.sharerId === sharerId)
      if (share?.stream) {
        share.stream.getTracks().forEach(track => track.stop())
      }
      this.activeScreenShares = this.activeScreenShares.filter(s => s.sharerId !== sharerId)
      this.updateParticipantScreenSharing(sharerId, false)
    },

    /**
     * Update screen share stream for a user
     */
    updateScreenShareStream(sharerId: string, stream: MediaStream) {
      const share = this.activeScreenShares.find(s => s.sharerId === sharerId)
      if (share) {
        share.stream = stream
      }
    },

    /**
     * Add a screen share peer connection
     */
    addScreenSharePeer(userId: string, connection: RTCPeerConnection) {
      this.screenSharePeers.set(userId, { connection })
    },

    /**
     * Update screen share peer with stream
     */
    updateScreenSharePeer(userId: string, stream: MediaStream) {
      const existing = this.screenSharePeers.get(userId)
      if (existing) {
        this.screenSharePeers.set(userId, { ...existing, stream })
      }
    },

    /**
     * Remove and cleanup a screen share peer connection
     */
    removeScreenSharePeer(userId: string) {
      const peer = this.screenSharePeers.get(userId)
      if (!peer) return

      try {
        peer.connection.close()
      } catch (error) {
        console.warn(`Error closing screen share peer connection for ${userId}:`, error)
      }

      if (peer.stream) {
        peer.stream.getTracks().forEach((track) => {
          track.stop()
          track.enabled = false
        })
      }

      this.screenSharePeers.delete(userId)
    },

    /**
     * Set local stream
     */
    setLocalStream(stream: MediaStream | null) {
      // Cleanup old stream
      if (this.localStream && stream !== this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop())
      }
      this.localStream = stream
    },

    /**
     * Set current channel
     */
    setCurrentChannel(channelId: number | null, channelName?: string) {
      this.currentChannelId = channelId
      this.currentChannelName = channelName || null
    },

    /**
     * Toggle mute state
     */
    toggleMute() {
      if (!this.localStream) return

      const audioTrack = this.localStream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        this.isMuted = !audioTrack.enabled
      }
    },

    /**
     * Toggle deafen state
     */
    toggleDeafen() {
      this.isDeafened = !this.isDeafened

      // Auto-mute when deafening
      if (this.isDeafened && !this.isMuted) {
        this.toggleMute()
      }

      // Mute/unmute all remote streams
      this.peers.forEach((peer) => {
        if (peer.stream) {
          peer.stream.getAudioTracks().forEach((track) => {
            track.enabled = !this.isDeafened
          })
        }
      })
    },

    /**
     * Set screen share quality
     */
    setScreenShareQuality(quality: ScreenShareQuality) {
      this.screenShareQuality = quality

      // Persist to localStorage
      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem('lootchat_screenshare_preferences')
          const prefs = stored ? JSON.parse(stored) : {}
          prefs.quality = quality
          localStorage.setItem('lootchat_screenshare_preferences', JSON.stringify(prefs))
        } catch (error) {
          console.warn('Failed to save screen share quality preference:', error)
        }
      }
    },

    /**
     * Update connection quality for a peer
     */
    updateConnectionQuality(userId: string, metrics: Partial<ConnectionQualityMetrics>) {
      const existing = this.connectionQuality.get(userId)
      this.connectionQuality.set(userId, {
        ...existing,
        ...metrics,
        lastUpdated: new Date()
      } as ConnectionQualityMetrics)
    },

    /**
     * Track connection error
     */
    trackError(userId: string, error: string) {
      const existing = this.connectionErrors.get(userId)
      this.connectionErrors.set(userId, {
        error,
        timestamp: new Date(),
        retries: (existing?.retries || 0) + 1
      })
    },

    /**
     * Clear error for a peer
     */
    clearError(userId: string) {
      this.connectionErrors.delete(userId)
    },

    /**
     * Set audio profile
     */
    setAudioProfile(profile: AudioProfile) {
      this.audioProfile = profile

      // Persist to localStorage
      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem('lootchat_audio_preferences')
          const prefs = stored ? JSON.parse(stored) : {}
          prefs.profile = profile
          localStorage.setItem('lootchat_audio_preferences', JSON.stringify(prefs))
        } catch (error) {
          console.warn('Failed to save audio profile preference:', error)
        }
      }
    },

    /**
     * Enumerate available audio input devices
     */
    async enumerateAudioDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        this.availableAudioDevices = devices.filter(device => device.kind === 'audioinput')
        return this.availableAudioDevices
      } catch (error) {
        console.warn('Failed to enumerate audio devices:', error)
        return []
      }
    },

    /**
     * Select audio input device
     */
    async selectAudioDevice(deviceId: string | null) {
      this.selectedAudioDevice = deviceId

      // Persist to localStorage
      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem('lootchat_audio_preferences')
          const prefs = stored ? JSON.parse(stored) : {}
          prefs.deviceId = deviceId
          localStorage.setItem('lootchat_audio_preferences', JSON.stringify(prefs))
        } catch (error) {
          console.warn('Failed to save audio device preference:', error)
        }
      }

      // If in a voice channel, restart the stream with the new device
      if (this.currentChannelId && this.localStream) {
        try {
          // Stop current stream
          this.localStream.getTracks().forEach(track => track.stop())

          // Get new stream with updated constraints
          const constraints = this.currentAudioConstraints
          const newStream = await navigator.mediaDevices.getUserMedia({ audio: constraints })

          // Update local stream
          this.localStream = newStream

          // Update all peer connections with new stream
          this.peers.forEach((peer) => {
            const audioTrack = newStream.getAudioTracks()[0]
            const sender = peer.connection.getSenders().find(s => s.track?.kind === 'audio')
            if (sender && audioTrack) {
              sender.replaceTrack(audioTrack)
            }
          })

          // Restart audio analyser
          this.setupLocalAudioAnalyser(newStream)
        } catch (error) {
          console.error('Failed to switch audio device:', error)
          throw error
        }
      }
    },

    /**
     * Add pending ICE candidate
     */
    addPendingCandidate(userId: string, candidate: RTCIceCandidateInit) {
      const list = this.pendingCandidates.get(userId) || []
      list.push(candidate)
      this.pendingCandidates.set(userId, list)

      // Limit queue size
      if (list.length > 100) {
        list.splice(0, list.length - 100)
      }
    },

    /**
     * Process pending ICE candidates for a peer
     */
    async processPendingCandidates(userId: string) {
      const peer = this.peers.get(userId)
      const candidates = this.pendingCandidates.get(userId)

      if (!peer || !candidates || candidates.length === 0) return

      for (const candidate of candidates) {
        try {
          await peer.connection.addIceCandidate(new RTCIceCandidate(candidate))
        } catch (error) {
          console.warn(`Failed to add queued ICE candidate for ${userId}:`, error)
        }
      }

      this.pendingCandidates.delete(userId)
    },

    /**
     * Start quality monitoring
     */
    startQualityMonitoring() {
      if (this.qualityMonitorInterval) return

      this.qualityMonitorInterval = setInterval(() => {
        this.checkAllConnectionQuality()
      }, this.qualityCheckInterval)
    },

    /**
     * Stop quality monitoring
     */
    stopQualityMonitoring() {
      if (this.qualityMonitorInterval) {
        clearInterval(this.qualityMonitorInterval)
        this.qualityMonitorInterval = null
      }
    },

    /**
     * Check connection quality for all peers
     */
    async checkAllConnectionQuality() {
      for (const [userId, peer] of this.peers.entries()) {
        try {
          await this.checkConnectionQuality(userId, peer.connection)
        } catch (error) {
          console.warn(`Failed to check quality for ${userId}:`, error)
        }
      }
    },

    /**
     * Check connection quality for a specific peer
     */
    async checkConnectionQuality(userId: string, pc: RTCPeerConnection) {
      try {
        const stats = await pc.getStats()

        stats.forEach((report) => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            const rtt = report.currentRoundTripTime
            const packetsLost = report.packetsLost || 0
            const jitter = report.jitter || 0

            const quality: 'excellent' | 'good' | 'poor'
              = rtt < 0.1 && packetsLost < 10
                ? 'excellent'
                : rtt < 0.3 && packetsLost < 50
                  ? 'good'
                  : 'poor'

            this.updateConnectionQuality(userId, {
              quality,
              rtt,
              packetsLost,
              jitter
            })
          }

          if (report.type === 'inbound-rtp' && report.kind === 'audio') {
            const bitrate = report.bytesReceived
              ? (report.bytesReceived * 8) / report.timestamp * 1000
              : undefined

            if (bitrate) {
              const existing = this.connectionQuality.get(userId)
              if (existing) {
                this.updateConnectionQuality(userId, { bitrate })
              }
            }
          }
        })
      } catch (error) {
        console.warn(`Error checking connection quality for ${userId}:`, error)
      }
    },

    /**
     * Adapt bitrate based on connection quality
     */
    async adaptBitrate(userId: string, quality: 'excellent' | 'good' | 'poor') {
      const peer = this.peers.get(userId)
      if (!peer) return

      const senders = peer.connection.getSenders()
      const audioSender = senders.find(s => s.track?.kind === 'audio')

      if (audioSender) {
        const params = audioSender.getParameters()

        if (params.encodings?.[0]) {
          params.encodings[0].maxBitrate
            = quality === 'excellent'
              ? 510000
              : quality === 'good'
                ? 256000
                : 128000

          try {
            await audioSender.setParameters(params)
          } catch (error) {
            console.warn(`Failed to adapt bitrate for ${userId}:`, error)
          }
        }
      }
    },

    /**
     * Setup audio analyser for local stream
     */
    setupLocalAudioAnalyser(stream: MediaStream) {
      // Close existing context
      if (this.localAudioContext && this.localAudioContext.state !== 'closed') {
        this.localAudioContext.close().catch(() => {})
      }

      const context = new AudioContext()
      const source = context.createMediaStreamSource(stream)
      const analyser = context.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.8
      source.connect(analyser)

      this.localAudioContext = context
      this.localAnalyser = analyser
    },

    /**
     * Setup audio analyser for remote stream
     */
    setupRemoteAudioAnalyser(userId: string, stream: MediaStream, audioEl: HTMLAudioElement) {
      const context = new AudioContext()
      const source = context.createMediaStreamSource(stream)
      const analyser = context.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.8
      source.connect(analyser)

      this.updatePeer(userId, {
        stream,
        audioEl,
        analyser,
        audioContext: context
      })
    },

    /**
     * Get audio level from analyser
     */
    getAudioLevel(analyser: AnalyserNode): number {
      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      analyser.getByteFrequencyData(dataArray)
      const sum = dataArray.reduce((a, b) => a + b, 0)
      const average = sum / dataArray.length

      return average > 0 ? 20 * Math.log10(average / 255) : -100
    },

    /**
     * Check speaking status for all participants
     */
    checkSpeaking() {
      // Check local speaking
      if (this.localAnalyser) {
        const level = this.getAudioLevel(this.localAnalyser)
        const isSpeaking = level > this.speakingThreshold && !this.isMuted

        // Find self in participants (if in channel)
        const selfUserId = this.participants.find(p => p.userId)?.userId
        if (selfUserId) {
          this.updateParticipantSpeaking(selfUserId, isSpeaking)
        }
      }

      // Check remote speaking
      this.peers.forEach((peer, userId) => {
        if (peer.analyser) {
          const level = this.getAudioLevel(peer.analyser)
          const isSpeaking = level > this.speakingThreshold
          this.updateParticipantSpeaking(userId, isSpeaking)
        }
      })
    },

    /**
     * Reset all state
     */
    reset() {
      // Stop monitoring
      this.stopQualityMonitoring()

      // Stop speaking detection
      if (this.speakingCheckFrameId !== null) {
        cancelAnimationFrame(this.speakingCheckFrameId)
        this.speakingCheckFrameId = null
      }

      // Cleanup peers
      this.peers.forEach((_, userId) => this.removePeer(userId))
      this.peers.clear()

      // Cleanup local stream
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop())
        this.localStream = null
      }

      // Cleanup screen share state
      if (this.screenStream) {
        this.screenStream.getTracks().forEach(track => track.stop())
        this.screenStream = null
      }
      this.isScreenSharing = false

      // Cleanup screen share peers
      this.screenSharePeers.forEach((_, userId) => this.removeScreenSharePeer(userId))
      this.screenSharePeers.clear()

      // Cleanup active screen shares
      this.activeScreenShares.forEach((share) => {
        if (share.stream) {
          share.stream.getTracks().forEach(track => track.stop())
        }
      })
      this.activeScreenShares = []

      // Cleanup audio contexts
      if (this.localAudioContext && this.localAudioContext.state !== 'closed') {
        this.localAudioContext.close().catch(() => {})
      }
      this.localAudioContext = null
      this.localAnalyser = null

      // Unsubscribe
      this.channelWebRTCSub?.unsubscribe()
      this.userSignalSub?.unsubscribe()
      this.channelWebRTCSub = null
      this.userSignalSub = null

      // Remove event listener
      if (typeof window !== 'undefined' && this.beforeUnloadHandler) {
        window.removeEventListener('beforeunload', this.beforeUnloadHandler)
        this.beforeUnloadHandler = null
      }

      // Clear state
      this.participants = []
      this.currentChannelId = null
      this.currentChannelName = null
      this.isMuted = false
      this.isDeafened = false
      this.pendingCandidates.clear()
      this.connectionQuality.clear()
      this.connectionErrors.clear()
      this.stompHandlersBound = false
    }
  }
})
