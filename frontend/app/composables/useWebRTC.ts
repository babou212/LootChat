import type { StompSubscription } from '@stomp/stompjs'
import type { WebRTCSignalRequest, WebRTCSignalResponse, WebRTCSignalType, VoiceParticipant } from '../../shared/types/chat'
import { useWebRTCStore, SCREEN_SHARE_PROFILES, type ScreenShareQuality } from '../../stores/webrtc'
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

  const isScreenSharing = computed(() => store.isScreenSharing)
  const screenStream = computed(() => store.screenStream)
  const activeScreenShares = computed(() => store.activeScreenShares)
  const hasActiveScreenShare = computed(() => store.hasActiveScreenShare)
  const currentScreenShare = computed(() => store.currentScreenShare)
  const screenShareQuality = computed(() => store.screenShareQuality)
  const screenShareSettings = computed(() => store.currentScreenShareSettings)

  const channelWebRTCSub = ref<StompSubscription | null>(null)
  const userSignalSub = ref<StompSubscription | null>(null)
  const beforeUnloadHandler = ref<((e: BeforeUnloadEvent) => void) | null>(null)
  const stompHandlersBound = ref(false)
  const speakingCheckFrame = ref<number | null>(null)
  const pendingCandidates = ref<Map<string, RTCIceCandidateInit[]>>(new Map())

  const avatarCache = new Map<string, string | undefined>()

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

  const checkSpeaking = () => {
    store.checkSpeaking()

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bindStompReconnectHandlers = (client: any) => {
    if (stompHandlersBound.value) return

    const prevOnConnect = client.onConnect
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client.onConnect = async (frame: any) => {
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
              try {
                const signal = JSON.parse(message.body) as WebRTCSignalResponse
                handleSignal(signal)
              } catch (error) {
                logger.error('Error parsing WebRTC signal during reconnect', error)
              }
            }
          )

          userSignalSub.value = wsClient.subscribe(
            `/user/queue/webrtc/signal`,
            (message: { body: string }) => {
              try {
                const signal = JSON.parse(message.body) as WebRTCSignalResponse
                handleSignal(signal)
              } catch (error) {
                logger.error('Error parsing user WebRTC signal during reconnect', error)
              }
            }
          )

          // Wait for subscriptions to be ready before sending JOIN
          await new Promise(resolve => setTimeout(resolve, 100))

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

      channelWebRTCSub.value = null
      userSignalSub.value = null
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
        const track = event.track
        logger.debug(`Received track from peer ${userId}: kind=${track.kind}, stream has ${remoteStream?.getTracks().length || 0} tracks`)

        if (remoteStream) {
          // Handle video track (screen share)
          if (track.kind === 'video') {
            logger.info(`Received video track from peer ${userId} - screen share`)

            // Find or create screen share info
            const existingShare = store.activeScreenShares.find(s => s.sharerId === userId)
            if (existingShare) {
              existingShare.stream = remoteStream
            } else {
              // Find the participant to get username
              const participant = participants.value.find(p => p.userId === userId)
              store.addActiveScreenShare({
                sharerId: userId,
                sharerUsername: participant?.username || userId,
                stream: remoteStream
              })
            }

            // Track ended listener for when remote stops sharing
            track.onended = () => {
              logger.info(`Video track from ${userId} ended - screen share stopped`)
              store.removeActiveScreenShare(userId)
            }

            return
          }

          // Handle audio track (voice or screen share audio)
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

      if (retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000 // 1s, 2s, 4s
        logger.info(`Retrying peer connection creation in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`)

        await new Promise(resolve => setTimeout(resolve, delay))
        return createPeerConnection(userId, retryCount + 1)
      }

      throw error
    }
  }

  const sendSignal = (signal: WebRTCSignalRequest, retryCount = 0) => {
    const maxRetries = 3
    const { getClient, isConnected } = useWebSocket()
    const client = getClient()

    if (!client) {
      logger.warn('Cannot send signal - STOMP client not initialized')
      return
    }

    if (!client.connected) {
      if (retryCount < maxRetries) {
        const delay = 500 * (retryCount + 1)
        logger.warn(`Cannot send signal (type: ${signal.type}) - STOMP client not connected (isConnected: ${isConnected.value}), retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`)

        setTimeout(() => {
          sendSignal(signal, retryCount + 1)
        }, delay)
      } else {
        logger.error(`Failed to send signal (type: ${signal.type}) after ${maxRetries} retries - STOMP client not connected`)
      }
      return
    }

    try {
      client.publish({
        destination: '/app/webrtc/signal',
        body: JSON.stringify(signal)
      })
      logger.debug(`Sent signal: ${signal.type} to ${signal.toUserId || 'broadcast'}`)
    } catch (error) {
      logger.error(`Error publishing signal (type: ${signal.type})`, error)
      if (retryCount < maxRetries) {
        setTimeout(() => {
          sendSignal(signal, retryCount + 1)
        }, 500)
      }
    }
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
          if (!participants.value.find((p: VoiceParticipant) => p.userId === fromUserId)) {
            const avatar = await fetchUserAvatar(fromUserId)
            store.addParticipant({
              userId: fromUserId,
              username: signal.fromUsername || fromUserId,
              avatar,
              isMuted: false,
              isSpeaking: false,
              isScreenSharing: false
            })
          }

          if (fromUserId === myId) break

          if (!signal.toUserId && currentChannelId.value) {
            // This is a broadcast JOIN from a new user
            // Send direct JOIN response so they know we're here
            sendSignal({
              channelId: currentChannelId.value,
              type: 'JOIN' as WebRTCSignalType,
              fromUserId: myId,
              toUserId: fromUserId
            })

            const existingPeer = peers.value.get(fromUserId)
            if (shouldInitiateOffer(fromUserId) && !existingPeer) {
              // Small delay to ensure the new peer has their subscriptions ready
              await new Promise(resolve => setTimeout(resolve, 150))
              logger.info(`Creating offer to new peer ${fromUserId} (broadcast JOIN)`)
              await createOffer(fromUserId)
            }
          } else if (signal.toUserId === myId && currentChannelId.value) {
            // This is a direct JOIN response from an existing user
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

        case 'SCREEN_SHARE_START':
          if (fromUserId !== myId) {
            logger.info(`User ${signal.fromUsername || fromUserId} started screen sharing`)
            store.addActiveScreenShare({
              sharerId: fromUserId,
              sharerUsername: signal.fromUsername || fromUserId
            })
            // The screen share stream will come through a separate offer
          }
          break

        case 'SCREEN_SHARE_STOP':
          if (fromUserId !== myId) {
            logger.info(`User ${signal.fromUsername || fromUserId} stopped screen sharing`)
            store.removeActiveScreenShare(fromUserId)
            store.removeScreenSharePeer(fromUserId)
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
        offerToReceiveAudio: true,
        offerToReceiveVideo: true // Enable receiving video for screen shares
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
      const existingPeer = peers.value.get(userId)
      let pc = existingPeer?.connection

      if (pc) {
        // Handle renegotiation - connection exists and is stable, apply the new offer
        if (pc.signalingState === 'stable') {
          logger.info(`Renegotiating with ${userId} - existing connection is stable, applying new offer`)
          // This is a renegotiation (e.g., screen share added), just set the new remote description
          // Don't recreate the connection, just update it
        } else if (pc.signalingState === 'have-local-offer') {
          // Glare situation - both sides sent offers simultaneously
          // Use tie-breaker: lower ID wins and rolls back
          const myId = user.value?.userId.toString() || ''
          const shouldRollback = (() => {
            try {
              return BigInt(myId) > BigInt(userId)
            } catch {
              return myId > userId
            }
          })()

          if (shouldRollback) {
            logger.info(`Glare with ${userId} - rolling back our offer`)
            await pc.setLocalDescription({ type: 'rollback' })
          } else {
            logger.info(`Glare with ${userId} - ignoring their offer (we win)`)
            return
          }
        } else {
          logger.warn(`Received offer from ${userId} but peer connection is in ${pc.signalingState} state. Recreating connection.`)
          removePeer(userId)
          pc = await createPeerConnection(userId)
          store.addPeer(userId, pc)
        }
      } else {
        pc = await createPeerConnection(userId)
        store.addPeer(userId, pc)
      }

      await pc.setRemoteDescription(new RTCSessionDescription(offer))

      // Create answer - include video receiving capability for screen shares
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
        peer.stream.getTracks().forEach((track: MediaStreamTrack) => track.stop())
      }
      if (peer.audioContext) {
        peer.audioContext.close().catch(() => {})
      }
      peers.value.delete(userId)
    }
  }

  const joinVoiceChannel = async (channelId: number, channelName?: string) => {
    if (!user.value) return

    if (currentChannelId.value !== null && currentChannelId.value !== channelId) {
      leaveVoiceChannel()
    }

    try {
      const { getClient, isConnected } = useWebSocket()

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

      store.localStream = stream
      store.currentChannelId = channelId
      store.currentChannelName = channelName || null

      bindStompReconnectHandlers(client)

      store.setupLocalAudioAnalyser(stream)

      startSpeakingDetection()

      store.addParticipant({
        userId: user.value.userId.toString(),
        username: user.value.username,
        avatar: user.value.avatar,
        isMuted: false,
        isSpeaking: false,
        isScreenSharing: false
      })

      // Subscribe to channel WebRTC topic for broadcast signals (JOIN, LEAVE, SCREEN_SHARE)
      channelWebRTCSub.value = client.subscribe(`/topic/channels/${channelId}/webrtc`, (message: { body: string }) => {
        try {
          const signal = JSON.parse(message.body) as WebRTCSignalResponse
          handleSignal(signal)
        } catch (error) {
          logger.error('Error parsing WebRTC signal from channel topic', error)
        }
      })

      // Subscribe to user-specific queue for direct signals (OFFER, ANSWER, ICE_CANDIDATE)
      userSignalSub.value = client.subscribe(`/user/queue/webrtc/signal`, (message: { body: string }) => {
        try {
          const signal = JSON.parse(message.body) as WebRTCSignalResponse
          handleSignal(signal)
        } catch (error) {
          logger.error('Error parsing WebRTC signal from user queue', error)
        }
      })

      // Wait a brief moment for subscriptions to be fully established
      // This prevents race conditions where we send JOIN before subscription is active
      await new Promise(resolve => setTimeout(resolve, 100))

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

    stopSpeakingDetection()

    try {
      channelWebRTCSub.value?.unsubscribe()
      channelWebRTCSub.value = null
    } catch (error) {
      logger.warn('Error unsubscribing from channel WebRTC', error)
    }

    try {
      userSignalSub.value?.unsubscribe()
      userSignalSub.value = null
    } catch (error) {
      logger.warn('Error unsubscribing from user signal', error)
    }

    if (typeof window !== 'undefined' && beforeUnloadHandler.value) {
      window.removeEventListener('beforeunload', beforeUnloadHandler.value)
      beforeUnloadHandler.value = null
    }

    pendingCandidates.value.clear()

    store.reset()

    logger.info('Successfully left voice channel')
  }

  const toggleMute = () => {
    store.toggleMute()

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

  /**
   * Start screen sharing with Discord-like screen picker
   * Supports capturing entire screens, windows, or browser tabs
   */
  const startScreenShare = async () => {
    if (!user.value || !currentChannelId.value) {
      logger.warn('Cannot start screen share - not in a voice channel')
      return
    }

    if (store.isScreenSharing) {
      logger.warn('Already screen sharing')
      return
    }

    try {
      // Get screen share constraints from store based on quality setting
      const displayMediaOptions = store.currentScreenShareConstraints
      const qualitySettings = store.currentScreenShareSettings

      logger.info(`Requesting screen capture with quality: ${qualitySettings.label} (${qualitySettings.width}x${qualitySettings.height}@${qualitySettings.frameRate}fps, max ${qualitySettings.maxBitrate}kbps)`)
      const screenStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions)

      // Set up track ended listener to handle browser's native stop sharing button
      const videoTrack = screenStream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.onended = () => {
          logger.info('Screen share ended by user (native browser UI)')
          stopScreenShare()
        }

        // Log actual track settings
        const settings = videoTrack.getSettings()
        logger.info(`Screen share actual settings: ${settings.width}x${settings.height}@${settings.frameRate}fps`)
      }

      store.setScreenStream(screenStream)
      store.updateParticipantScreenSharing(user.value.userId.toString(), true)

      // Notify other participants that we're starting screen share
      sendSignal({
        channelId: currentChannelId.value,
        type: 'SCREEN_SHARE_START' as WebRTCSignalType,
        fromUserId: user.value.userId.toString()
      })

      // Add our own screen share to active shares so we can see it locally
      store.addActiveScreenShare({
        sharerId: user.value.userId.toString(),
        sharerUsername: user.value.username,
        stream: screenStream
      })

      // Add screen tracks to all existing peer connections
      for (const [peerId, peer] of store.peers.entries()) {
        try {
          const videoTrack = screenStream.getVideoTracks()[0]
          const audioTracks = screenStream.getAudioTracks()

          if (videoTrack) {
            const sender = peer.connection.addTrack(videoTrack, screenStream)

            // Set encoding parameters for video bitrate
            const params = sender.getParameters()
            if (!params.encodings || params.encodings.length === 0) {
              params.encodings = [{}]
            }
            if (params.encodings[0]) {
              params.encodings[0].maxBitrate = qualitySettings.maxBitrate * 1000 // Convert kbps to bps
              params.encodings[0].maxFramerate = qualitySettings.frameRate
            }
            await sender.setParameters(params).catch((err: Error) => {
              logger.warn('Failed to set video encoding params', err)
            })

            logger.debug(`Added screen video track to peer ${peerId}`)
          }

          // Add system audio if available
          const audioTrack = audioTracks[0]
          if (audioTrack) {
            peer.connection.addTrack(audioTrack, screenStream)
            logger.debug(`Added screen audio track to peer ${peerId}`)
          }

          // Renegotiate connection
          const offer = await peer.connection.createOffer()
          await peer.connection.setLocalDescription(offer)

          sendSignal({
            channelId: currentChannelId.value!,
            type: 'OFFER' as WebRTCSignalType,
            fromUserId: user.value!.userId.toString(),
            toUserId: peerId,
            data: offer
          })

          logger.info(`Renegotiated connection with ${peerId} for screen share`)
        } catch (error) {
          logger.error(`Error adding screen share track to peer ${peerId}`, error)
        }
      }

      logger.info('Screen sharing started successfully')
    } catch (error) {
      if ((error as Error).name === 'NotAllowedError') {
        logger.info('User cancelled screen share picker')
      } else {
        logger.error('Error starting screen share', error)
        throw error
      }
    }
  }

  /**
   * Stop screen sharing
   */
  const stopScreenShare = () => {
    if (!user.value || !currentChannelId.value) return

    if (!store.isScreenSharing) {
      logger.debug('Not currently screen sharing')
      return
    }

    const myId = user.value.userId.toString()

    // Stop all screen stream tracks
    if (store.screenStream) {
      store.screenStream.getTracks().forEach((track) => {
        track.stop()
      })
    }

    // Remove screen tracks from all peer connections
    for (const [peerId, peer] of store.peers.entries()) {
      try {
        const senders = peer.connection.getSenders()
        for (const sender of senders) {
          if (sender.track?.kind === 'video') {
            peer.connection.removeTrack(sender)
            logger.debug(`Removed screen video track from peer ${peerId}`)
          }
        }

        // Renegotiate connection
        peer.connection.createOffer()
          .then((offer) => {
            peer.connection.setLocalDescription(offer)
            sendSignal({
              channelId: currentChannelId.value!,
              type: 'OFFER' as WebRTCSignalType,
              fromUserId: user.value!.userId.toString(),
              toUserId: peerId,
              data: offer
            })
          })
          .catch((err) => {
            logger.warn(`Error renegotiating after screen share stop for ${peerId}`, err)
          })
      } catch (error) {
        logger.warn(`Error removing screen share track from peer ${peerId}`, error)
      }
    }

    // Update state
    store.setScreenStream(null)
    store.removeActiveScreenShare(myId)
    store.updateParticipantScreenSharing(myId, false)

    // Notify other participants
    sendSignal({
      channelId: currentChannelId.value,
      type: 'SCREEN_SHARE_STOP' as WebRTCSignalType,
      fromUserId: myId
    })

    logger.info('Screen sharing stopped')
  }

  /**
   * Toggle screen sharing on/off
   */
  const toggleScreenShare = async () => {
    if (store.isScreenSharing) {
      stopScreenShare()
    } else {
      await startScreenShare()
    }
  }

  /**
   * Set screen share quality
   */
  const setScreenShareQuality = (quality: ScreenShareQuality) => {
    store.setScreenShareQuality(quality)
    logger.info(`Screen share quality set to: ${SCREEN_SHARE_PROFILES[quality].label}`)
  }

  return {
    localStream: readonly(localStream),
    peers: readonly(peers),
    participants: readonly(participants),
    isMuted: readonly(isMuted),
    isDeafened: readonly(isDeafened),
    currentChannelId: readonly(currentChannelId),
    currentChannelName: readonly(currentChannelName),
    // Screen sharing
    isScreenSharing: readonly(isScreenSharing),
    screenStream: readonly(screenStream),
    activeScreenShares: readonly(activeScreenShares),
    hasActiveScreenShare: readonly(hasActiveScreenShare),
    currentScreenShare: readonly(currentScreenShare),
    screenShareQuality: readonly(screenShareQuality),
    screenShareSettings: readonly(screenShareSettings),
    screenShareProfiles: SCREEN_SHARE_PROFILES,
    // Methods
    joinVoiceChannel,
    leaveVoiceChannel,
    toggleMute,
    toggleDeafen,
    startScreenShare,
    stopScreenShare,
    toggleScreenShare,
    setScreenShareQuality
  }
}
