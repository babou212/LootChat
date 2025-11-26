import type { Client } from '@stomp/stompjs'
import type { WebRTCSignalRequest, WebRTCSignalResponse, WebRTCSignalType, VoiceParticipant } from '../../shared/types/chat'
import { useWebRTCStore } from '~/stores/webrtc'
import { useVoiceLogger } from './useLogger'

export const useWebRTC = () => {
  const { user } = useAuth()
  const { public: publicRuntime } = useRuntimeConfig()
  const store = useWebRTCStore()
  const logger = useVoiceLogger()

  const localStream = computed(() => store.localStream)
  const peers = computed(() => store.peers)
  const participants = computed(() => store.participants)
  const isMuted = computed(() => store.isMuted)
  const isDeafened = computed(() => store.isDeafened)
  const currentChannelId = computed(() => store.currentChannelId)
  const currentChannelName = computed(() => store.currentChannelName)

  // Local state for subscriptions and handlers
  const channelWebRTCSub = ref<ReturnType<typeof useWebSocket>['subscribe']>()
  const userSignalSub = ref<ReturnType<typeof useWebSocket>['subscribe']>()
  const beforeUnloadHandler = ref<((e: BeforeUnloadEvent) => void) | null>(null)
  const stompHandlersBound = ref(false)
  const speakingCheckFrame = ref<number | null>(null)
  const pendingCandidates = ref<Map<string, RTCIceCandidateInit[]>>(new Map())

  // Cache for user avatars
  const avatarCache = new Map<string, string | undefined>()

  // Helper function to fetch user avatar
  const fetchUserAvatar = async (userId: string): Promise<string | undefined> => {
    if (avatarCache.has(userId)) {
      return avatarCache.get(userId)
    }

    try {
      const response = await $fetch<{ avatar?: string }>(`/api/users/${userId}`)
      const avatar = response.avatar
      avatarCache.set(userId, avatar)
      return avatar
    } catch {
      avatarCache.set(userId, undefined)
      return undefined
    }
  }

  // Use requestAnimationFrame for speaking detection
  const checkSpeaking = () => {
    store.checkSpeaking()
    
    // Schedule next check
    speakingCheckFrame.value = requestAnimationFrame(checkSpeaking)
  }

  const startSpeakingDetection = () => {
    if (speakingCheckFrame.value !== null) return
    logger.debug('Starting speaking detection')
    checkSpeaking()
  }

  const stopSpeakingDetection = () => {
    if (speakingCheckFrame.value !== null) {
      cancelAnimationFrame(speakingCheckFrame.value)
      speakingCheckFrame.value = null
      logger.debug('Stopped speaking detection')
    }
  }

  const bindStompReconnectHandlers = (client: Client) => {
    if (stompHandlersBound.value) return
    
    const prevOnConnect = client.onConnect
    client.onConnect = (frame: unknown) => {
      if (prevOnConnect) {
        try {
          prevOnConnect(frame)
        } catch (error) {
          logger.warn('Error in previous onConnect handler', error)
        }
      }
      
      if (currentChannelId.value && user.value) {
        try {
          channelWebRTCSub.value?.unsubscribe()
        } catch (error) {
          logger.warn('Error unsubscribing from channel WebRTC', error)
        }
        
        try {
          userSignalSub.value?.unsubscribe()
        } catch (error) {
          logger.warn('Error unsubscribing from user signal', error)
        }
        
        const { getClient } = useWebSocket()
        const wsClient = getClient()
        if (wsClient?.connected) {
          channelWebRTCSub.value = wsClient.subscribe(
            `/topic/channels/${currentChannelId.value}/webrtc`,
            (message: { body: string }) => {
              const signal = JSON.parse(message.body) as WebRTCSignalResponse
              handleSignal(signal)
            }
          )
          
          userSignalSub.value = wsClient.subscribe(
            `/user/queue/webrtc/signal`,
            (message: { body: string }) => {
              const signal = JSON.parse(message.body) as WebRTCSignalResponse
              handleSignal(signal)
            }
          )
          
          sendSignal({
            channelId: currentChannelId.value,
            type: 'JOIN' as WebRTCSignalType,
            fromUserId: user.value.userId.toString()
          })
          
          logger.info('Reconnected to voice channel, re-syncing')
        }
      }
    }

    const prevOnWebSocketClose = client.onWebSocketClose
    client.onWebSocketClose = (evt: unknown) => {
      if (prevOnWebSocketClose) {
        try {
          prevOnWebSocketClose(evt)
        } catch (error) {
          logger.warn('Error in previous onWebSocketClose handler', error)
        }
      }
      
      channelWebRTCSub.value = undefined
      userSignalSub.value = undefined
      logger.info('WebSocket closed, cleared subscriptions')
    }
    
    stompHandlersBound.value = true
  }

  const getRTCConfiguration = (): RTCConfiguration => {
    const baseStun = [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302'
    ]

    const iceServers: RTCIceServer[] = baseStun.map(url => ({ urls: url }))

    const turnUrlsRaw = (publicRuntime.webrtcTurnUrls as string | undefined) || ''
    const turnUsername = (publicRuntime.webrtcTurnUsername as string | undefined) || undefined
    const turnCredential = (publicRuntime.webrtcTurnCredential as string | undefined) || undefined
    const policy = (publicRuntime.webrtcIceTransportPolicy as 'all' | 'relay' | undefined) || 'all'

    if (turnUrlsRaw.trim().length > 0) {
      const turnUrls = turnUrlsRaw
        .split(',')
        .map(u => u.trim())
        .filter(Boolean)

      turnUrls.forEach((url) => {
        iceServers.push({
          urls: url,
          username: turnUsername,
          credential: turnCredential
        })
      })
    }

    const cfg: RTCConfiguration = { iceServers }
    if (policy === 'relay') cfg.iceTransportPolicy = 'relay'
    return cfg
  }

  const createPeerConnection = async (userId: string, retryCount = 0): Promise<RTCPeerConnection> => {
    const maxRetries = 3
    
    try {
      const pc = new RTCPeerConnection(getRTCConfiguration())

      if (localStream.value) {
        const tracks = localStream.value.getTracks()
        logger.debug(`Adding ${tracks.length} tracks to peer connection for user ${userId}`)
        
        tracks.forEach((track: MediaStreamTrack) => {
          logger.debug(`Adding track: kind=${track.kind}, enabled=${track.enabled}, readyState=${track.readyState}`)
          if (localStream.value) {
            const sender = pc.addTrack(track, localStream.value)
            if (track.kind === 'audio') {
              const params = sender.getParameters()
              if (!params.encodings || params.encodings.length === 0) {
                params.encodings = [{}]
              }
              if (params.encodings[0]) {
                params.encodings[0].maxBitrate = 510000 // 510 kbps
                params.encodings[0].priority = 'high'
              }
              sender.setParameters(params).catch((err: Error) => {
                logger.warn('Failed to set audio encoding params', err)
              })
            }
          }
        })
      }

      pc.ontrack = (event) => {
        const [remoteStream] = event.streams
        logger.debug(`Received track from peer ${userId}, stream has ${remoteStream?.getTracks().length || 0} tracks`)

        if (remoteStream) {
          // Create or reuse audio element
          const existingPeer = store.peers.get(userId)
          let audio = existingPeer?.audioEl
          
          if (!audio) {
            audio = new Audio()
            audio.autoplay = true
          }
          
          audio.srcObject = remoteStream
          logger.debug(`Playing remote audio from user ${userId}`)
          
          audio.play()
            .then(() => {
              logger.info(`Successfully started playing audio from user ${userId}`)
            })
            .catch((err: Error) => {
              logger.error(`Error playing audio from user ${userId}`, err)
            })

          // Setup audio analyser and update store
          store.setupRemoteAudioAnalyser(userId, remoteStream, audio)
        }
      }

      pc.onicecandidate = (event) => {
        if (event.candidate && currentChannelId.value && user.value) {
          sendSignal({
            channelId: currentChannelId.value,
            type: 'ICE_CANDIDATE' as WebRTCSignalType,
            fromUserId: user.value.userId.toString(),
            toUserId: userId,
            data: event.candidate.toJSON() as RTCIceCandidateInit
          })
        }
      }

      pc.oniceconnectionstatechange = async () => {
        logger.debug(`ICE connection state for ${userId}: ${pc.iceConnectionState}`)
        
        if (pc.iceConnectionState === 'failed') {
          logger.warn(`ICE connection failed for ${userId}, attempting restart`)
          await tryIceRestart(userId)
        } else if (pc.iceConnectionState === 'disconnected') {
          setTimeout(() => {
            if (pc.iceConnectionState === 'disconnected') {
              logger.info(`Peer ${userId} disconnected, removing`)
              removePeer(userId)
            }
          }, 3000)
        } else if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          logger.info(`Successfully connected to peer ${userId}`)
        }
      }

      pc.onconnectionstatechange = async () => {
        logger.debug(`Connection state for ${userId}: ${pc.connectionState}`)
        
        if (pc.connectionState === 'failed') {
          logger.warn(`Connection failed for ${userId}, attempting restart`)
          await tryIceRestart(userId)
        } else if (pc.connectionState === 'disconnected') {
          setTimeout(() => {
            if (pc.connectionState === 'disconnected') {
              logger.info(`Peer ${userId} disconnected, removing`)
              removePeer(userId)
            }
          }, 3000)
        } else if (pc.connectionState === 'connected') {
          logger.info(`Peer connection established with user ${userId}`)
          // Start connection quality monitoring
          store.checkConnectionQuality(userId, pc)
        }
      }

      return pc
    } catch (error) {
      logger.error(`Error creating peer connection for user ${userId}`, error)
      
      // Retry logic with exponential backoff
      if (retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000 // 1s, 2s, 4s
        logger.info(`Retrying peer connection creation in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`)
        
        await new Promise(resolve => setTimeout(resolve, delay))
        return createPeerConnection(userId, retryCount + 1)
      }
      
      throw error
    }
  }

  const sendSignal = (signal: WebRTCSignalRequest) => {
    const { getClient, isConnected } = useWebSocket()
    const client = getClient()

    if (!client) {
      logger.warn('Cannot send signal - STOMP client not initialized')
      return
    }

    if (!client.connected) {
      logger.warn(`Cannot send signal (type: ${signal.type}) - STOMP client not connected (isConnected: ${isConnected.value}), queuing for retry...`)
      
      // Retry after a short delay
      setTimeout(() => {
        const retryClient = getClient()
        if (retryClient?.connected) {
          retryClient.publish({
            destination: '/app/webrtc/signal',
            body: JSON.stringify(signal)
          })
          logger.debug(`Successfully sent queued signal: ${signal.type}`)
        } else {
          logger.error('Cannot send signal - STOMP client still not connected after retry')
        }
      }, 500)
      return
    }

    client.publish({
      destination: '/app/webrtc/signal',
      body: JSON.stringify(signal)
    })
    logger.debug(`Sent signal: ${signal.type} to ${signal.toUserId || 'broadcast'}`)
  }

  const handleSignal = async (signal: WebRTCSignalResponse) => {
    if (!user.value) return

    const { type, fromUserId, data } = signal
    const myId = user.value.userId.toString()

    logger.debug(`Received signal: ${type} from ${fromUserId} (toUserId: ${signal.toUserId || 'broadcast'})`)

    const shouldInitiateOffer = (peerId: string) => {
      try {
        return BigInt(myId) < BigInt(peerId)
      } catch {
        return myId < peerId
      }
    }

    try {
      switch (type) {
        case 'JOIN':
          if (!participants.value.find((p) => p.userId === fromUserId)) {
            // Fetch avatar for the joining user
            const avatar = await fetchUserAvatar(fromUserId)
            store.addParticipant({
              userId: fromUserId,
              username: signal.fromUsername || fromUserId,
              avatar,
              isMuted: false,
              isSpeaking: false
            })
          }

          if (fromUserId === myId) break

          if (!signal.toUserId && currentChannelId.value) {
            sendSignal({
              channelId: currentChannelId.value,
              type: 'JOIN' as WebRTCSignalType,
              fromUserId: myId,
              toUserId: fromUserId
            })

            const existingPeer = peers.value.get(fromUserId)
            if (shouldInitiateOffer(fromUserId) && !existingPeer) {
              logger.info(`Creating offer to new peer ${fromUserId} (broadcast JOIN)`)
              await createOffer(fromUserId)
            }
          } else if (signal.toUserId === myId && currentChannelId.value) {
            const existingPeer = peers.value.get(fromUserId)
            if (shouldInitiateOffer(fromUserId) && !existingPeer) {
              logger.info(`Creating offer to peer ${fromUserId} (direct JOIN response)`)
              await createOffer(fromUserId)
            } else if (!shouldInitiateOffer(fromUserId) && !existingPeer) {
              logger.info(`Waiting for offer from peer ${fromUserId} (they should initiate)`)
            }
          }
          break

        case 'LEAVE':
          store.removeParticipant(fromUserId)
          removePeer(fromUserId)
          logger.info(`Peer ${fromUserId} left`)
          break

        case 'OFFER':
          if (data && fromUserId !== user.value.userId.toString()) {
            await handleOffer(fromUserId, data as RTCSessionDescriptionInit)
          }
          break

        case 'ANSWER':
          if (data && fromUserId !== user.value.userId.toString()) {
            await handleAnswer(fromUserId, data as RTCSessionDescriptionInit)
          }
          break

        case 'ICE_CANDIDATE':
          if (data && fromUserId !== user.value.userId.toString()) {
            await handleIceCandidate(fromUserId, data as RTCIceCandidateInit)
          }
          break
      }
    } catch (error) {
      logger.error('Error handling WebRTC signal', error)
    }
  }

  const createOffer = async (userId: string) => {
    try {
      logger.info(`Creating peer connection and offer for user ${userId}`)
      const pc = await createPeerConnection(userId)
      store.addPeer(userId, pc)

      const offer = await pc.createOffer({
        offerToReceiveAudio: true
      })
      await pc.setLocalDescription(offer)

      if (currentChannelId.value && user.value) {
        logger.info(`Sending offer to user ${userId}`)
        sendSignal({
          channelId: currentChannelId.value,
          type: 'OFFER' as WebRTCSignalType,
          fromUserId: user.value.userId.toString(),
          toUserId: userId,
          data: offer
        })
      }
    } catch (error) {
      logger.error(`Error creating offer for user ${userId}`, error)
    }
  }

  const handleOffer = async (userId: string, offer: RTCSessionDescriptionInit) => {
    try {
      logger.info(`Received offer from user ${userId}`)
      let pc = peers.value.get(userId)?.connection

      if (pc) {
        if (pc.signalingState !== 'stable') {
          logger.warn(`Received offer from ${userId} but peer connection is in ${pc.signalingState} state. Recreating connection.`)
          removePeer(userId)
          pc = await createPeerConnection(userId)
        }
      } else {
        pc = await createPeerConnection(userId)
      }

      await pc.setRemoteDescription(new RTCSessionDescription(offer))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      const queued = pendingCandidates.value.get(userId) || []
      for (const c of queued) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(c))
        } catch (e) {
          logger.warn('Failed to add queued ICE candidate after offer handling', e)
        }
      }
      pendingCandidates.value.delete(userId)

      if (currentChannelId.value && user.value) {
        logger.info(`Sending answer to user ${userId}`)
        sendSignal({
          channelId: currentChannelId.value,
          type: 'ANSWER' as WebRTCSignalType,
          fromUserId: user.value.userId.toString(),
          toUserId: userId,
          data: answer
        })
      }
    } catch (error) {
      logger.error(`Error handling offer from user ${userId}`, error)
    }
  }

  const handleAnswer = async (userId: string, answer: RTCSessionDescriptionInit) => {
    try {
      logger.info(`Received answer from user ${userId}`)
      const peer = peers.value.get(userId)
      if (peer) {
        if (peer.connection.signalingState !== 'have-local-offer') {
          logger.warn(`Received answer from ${userId} but peer connection is in ${peer.connection.signalingState} state, expected 'have-local-offer'`)
          return
        }

        await peer.connection.setRemoteDescription(new RTCSessionDescription(answer))
        logger.info(`Successfully set remote description for answer from user ${userId}`)

        const queued = pendingCandidates.value.get(userId) || []
        for (const c of queued) {
          try {
            await peer.connection.addIceCandidate(new RTCIceCandidate(c))
          } catch (e) {
            logger.warn('Failed to add queued ICE candidate after answer handling', e)
          }
        }
        pendingCandidates.value.delete(userId)
      } else {
        logger.warn(`Received answer from ${userId} but no peer connection exists`)
      }
    } catch (error) {
      logger.error(`Error handling answer from user ${userId}`, error)
    }
  }

  const handleIceCandidate = async (userId: string, candidate: RTCIceCandidateInit) => {
    try {
      const peer = peers.value.get(userId)
      if (peer && peer.connection.remoteDescription) {
        await peer.connection.addIceCandidate(new RTCIceCandidate(candidate))
        logger.debug(`Added ICE candidate for ${userId}`)
      } else {
        const list = pendingCandidates.value.get(userId) || []
        list.push(candidate)
        pendingCandidates.value.set(userId, list)
        if (list.length > 100) {
          list.splice(0, list.length - 100)
        }
        logger.debug(`Queued ICE candidate for ${userId} (${list.length} queued)`)
      }
    } catch (error) {
      logger.error('Error handling ICE candidate', error)
    }
  }

  const tryIceRestart = async (userId: string) => {
    const peer = peers.value.get(userId)
    if (!peer || !user.value || !currentChannelId.value) return
    const pc = peer.connection
    try {
      if (pc.signalingState === 'stable') {
        logger.info(`Attempting ICE restart with peer ${userId}`)
        const offer = await pc.createOffer({ iceRestart: true })
        await pc.setLocalDescription(offer)
        sendSignal({
          channelId: currentChannelId.value,
          type: 'OFFER' as WebRTCSignalType,
          fromUserId: user.value.userId.toString(),
          toUserId: userId,
          data: offer
        })
      } else {
        logger.warn(`Cannot ICE-restart with ${userId}, signalingState=${pc.signalingState}`)
      }
    } catch (e) {
      logger.error('ICE restart failed, removing peer', e)
      removePeer(userId)
    }
  }

  const removePeer = (userId: string) => {
    const peer = peers.value.get(userId)
    if (peer) {
      peer.connection.close()
      if (peer.stream) {
        peer.stream.getTracks().forEach(track => track.stop())
      }
      if (peer.audioContext) {
        peer.audioContext.close().catch(() => {})
      }
      peers.value.delete(userId)
    }
  }

  const joinVoiceChannel = async (channelId: number, channelName?: string) => {
    if (!user.value) return

    // If already in a voice channel, leave it first
    if (currentChannelId.value !== null && currentChannelId.value !== channelId) {
      leaveVoiceChannel()
    }

    try {
      const { getClient, isConnected } = useWebSocket()

      // Wait for WebSocket connection with timeout
      const waitForConnection = async (timeoutMs = 5000) => {
        const startTime = Date.now()
        while (!isConnected.value && Date.now() - startTime < timeoutMs) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        return isConnected.value
      }

      if (!isConnected.value) {
        logger.info('WebSocket not connected, waiting...')
        const connected = await waitForConnection()
        if (!connected) {
          throw new Error('WebSocket connection timeout. Please try again.')
        }
      }

      const client = getClient()
      if (!client) {
        throw new Error('WebSocket client not available. Please try again.')
      }

      logger.info(`Joining channel ${channelId}, client connected: ${client.connected}`)

      if (!client.connected) {
        throw new Error('WebSocket client not connected. Please try again.')
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Your browser does not support microphone access. Please use a modern browser like Chrome, Firefox, or Edge.')
      }

      // Get audio constraints from store profile
      const audioConstraints = store.currentAudioConstraints

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: false
      })

      const tracks = stream.getTracks()
      logger.info(`Got local media stream with ${tracks.length} tracks`)
      tracks.forEach((track: MediaStreamTrack) => {
        logger.debug(`Local track: kind=${track.kind}, enabled=${track.enabled}, readyState=${track.readyState}, label=${track.label}`)
      })

      // Update store
      store.localStream = stream
      store.currentChannelId = channelId
      store.currentChannelName = channelName || null
      
      bindStompReconnectHandlers(client)

      // Setup local audio analyser
      store.setupLocalAudioAnalyser(stream)

      // Start speaking detection
      startSpeakingDetection()

      // Add self as participant
      store.addParticipant({
        userId: user.value.userId.toString(),
        username: user.value.username,
        avatar: user.value.avatar,
        isMuted: false,
        isSpeaking: false
      })

      // Subscribe to WebRTC channels
      channelWebRTCSub.value = client.subscribe(`/topic/channels/${channelId}/webrtc`, (message: { body: string }) => {
        const signal = JSON.parse(message.body) as WebRTCSignalResponse
        handleSignal(signal)
      })

      userSignalSub.value = client.subscribe(`/user/queue/webrtc/signal`, (message: { body: string }) => {
        const signal = JSON.parse(message.body) as WebRTCSignalResponse
        handleSignal(signal)
      })

      logger.info(`Subscribed to WebRTC channels, sending JOIN signal`)

      sendSignal({
        channelId,
        type: 'JOIN' as WebRTCSignalType,
        fromUserId: user.value.userId.toString()
      })

      if (typeof window !== 'undefined') {
        beforeUnloadHandler.value = () => {
          try {
            leaveVoiceChannel()
          } catch {
            // best-effort cleanup
          }
        }
        window.addEventListener('beforeunload', beforeUnloadHandler.value)
      }
      
      logger.info(`Successfully joined voice channel ${channelId}`)
    } catch (error) {
      logger.error('Error joining voice channel', error)
      throw error
    }
  }

  const leaveVoiceChannel = () => {
    if (!user.value || !currentChannelId.value) return

    logger.info(`Leaving voice channel ${currentChannelId.value}`)

    sendSignal({
      channelId: currentChannelId.value,
      type: 'LEAVE' as WebRTCSignalType,
      fromUserId: user.value.userId.toString()
    })

    // Stop speaking detection
    stopSpeakingDetection()

    // Unsubscribe from channels
    try {
      channelWebRTCSub.value?.unsubscribe()
      channelWebRTCSub.value = undefined
    } catch (error) {
      logger.warn('Error unsubscribing from channel WebRTC', error)
    }

    try {
      userSignalSub.value?.unsubscribe()
      userSignalSub.value = undefined
    } catch (error) {
      logger.warn('Error unsubscribing from user signal', error)
    }

    // Remove beforeunload handler
    if (typeof window !== 'undefined' && beforeUnloadHandler.value) {
      window.removeEventListener('beforeunload', beforeUnloadHandler.value)
      beforeUnloadHandler.value = null
    }

    // Clear pending candidates
    pendingCandidates.value.clear()

    // Reset store (handles all cleanup)
    store.reset()

    logger.info('Successfully left voice channel')
  }

  const toggleMute = () => {
    store.toggleMute()
    
    // Update participant state
    if (user.value) {
      const userId = user.value.userId.toString()
      const selfParticipant = participants.value.find((p: VoiceParticipant) => p.userId === userId)
      if (selfParticipant) {
        selfParticipant.isMuted = store.isMuted
      }
    }
    
    logger.info(`Mute toggled: ${store.isMuted}`)
  }

  const toggleDeafen = () => {
    store.toggleDeafen()
    logger.info(`Deafen toggled: ${store.isDeafened}`)
  }

  return {
    localStream: readonly(localStream),
    peers: readonly(peers),
    participants: readonly(participants),
    isMuted: readonly(isMuted),
    isDeafened: readonly(isDeafened),
    currentChannelId: readonly(currentChannelId),
    currentChannelName: readonly(currentChannelName),
    joinVoiceChannel,
    leaveVoiceChannel,
    toggleMute,
    toggleDeafen
  }
}
