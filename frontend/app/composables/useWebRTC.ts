import type { StompSubscription, Client } from '@stomp/stompjs'
import type { WebRTCSignalRequest, WebRTCSignalResponse, WebRTCSignalType, VoiceParticipant } from '../../shared/types/chat'

interface PeerConnection {
  connection: RTCPeerConnection
  stream?: MediaStream
  audioEl?: HTMLAudioElement
  analyser?: AnalyserNode
  audioContext?: AudioContext
}

export const useWebRTC = () => {
  const { user } = useAuth()
  const { public: publicRuntime } = useRuntimeConfig()

  const localStream = ref<MediaStream | null>(null)
  const peers = ref<Map<string, PeerConnection>>(new Map())
  const participants = ref<VoiceParticipant[]>([])
  const isMuted = ref(false)
  const isDeafened = ref(false)
  const currentChannelId = ref<number | null>(null)

  let signalSubscription: StompSubscription | null = null
  let channelWebRTCSub: StompSubscription | null = null
  let userSignalSub: StompSubscription | null = null
  let stompClient: Client | null = null
  let beforeUnloadHandler: ((e: BeforeUnloadEvent) => void) | null = null
  let stompHandlersBound = false
  let localAnalyser: AnalyserNode | null = null
  let localAudioContext: AudioContext | null = null
  let speakingCheckInterval: ReturnType<typeof setInterval> | null = null

  const toastLastShown = new Map<string, number>()
  const maybeToast = (key: string, title: string, description?: string, cooldownMs = 8000) => {
    if (typeof window === 'undefined') return
    const now = Date.now()
    const last = toastLastShown.get(key) || 0
    if (now - last < cooldownMs) return
    toastLastShown.set(key, now)
    try {
      const toast = useToast()
      toast.add({ title, description })
    } catch {
      // ignore
    }
  }

  const SPEAKING_THRESHOLD = -30 // dB threshold

  const setupAudioAnalyser = (stream: MediaStream, audioContext?: AudioContext): { analyser: AnalyserNode, context: AudioContext } => {
    const context = audioContext || new AudioContext()
    const source = context.createMediaStreamSource(stream)
    const analyser = context.createAnalyser()
    analyser.fftSize = 512
    analyser.smoothingTimeConstant = 0.8
    source.connect(analyser)
    return { analyser, context }
  }

  const getAudioLevel = (analyser: AnalyserNode): number => {
    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    analyser.getByteFrequencyData(dataArray)
    const sum = dataArray.reduce((a, b) => a + b, 0)
    const average = sum / dataArray.length

    return average > 0 ? 20 * Math.log10(average / 255) : -100
  }

  const checkSpeaking = () => {
    if (localAnalyser && user.value) {
      const level = getAudioLevel(localAnalyser)
      const isSpeaking = level > SPEAKING_THRESHOLD && !isMuted.value
      const selfParticipant = participants.value.find(p => p.userId === user.value?.userId.toString())
      if (selfParticipant && selfParticipant.isSpeaking !== isSpeaking) {
        selfParticipant.isSpeaking = isSpeaking
      }
    }

    peers.value.forEach((peer, userId) => {
      if (peer.analyser) {
        const level = getAudioLevel(peer.analyser)
        const isSpeaking = level > SPEAKING_THRESHOLD
        const participant = participants.value.find(p => p.userId === userId)
        if (participant && participant.isSpeaking !== isSpeaking) {
          participant.isSpeaking = isSpeaking
        }
      }
    })
  }

  const bindStompReconnectHandlers = (client: Client) => {
    if (stompHandlersBound) return
    const prevOnConnect = client.onConnect
    client.onConnect = (frame) => {
      if (prevOnConnect) {
        try {
          prevOnConnect(frame)
        } catch {
          // ignore
        }
      }
      if (currentChannelId.value && user.value) {
        try {
          channelWebRTCSub?.unsubscribe()
        } catch {
          // ignore
        }
        try {
          userSignalSub?.unsubscribe()
        } catch {
          // ignore
        }
        channelWebRTCSub = client.subscribe(`/topic/channels/${currentChannelId.value}/webrtc`, (message: { body: string }) => {
          const signal = JSON.parse(message.body) as WebRTCSignalResponse
          handleSignal(signal)
        })
        userSignalSub = client.subscribe(`/user/queue/webrtc/signal`, (message: { body: string }) => {
          const signal = JSON.parse(message.body) as WebRTCSignalResponse
          handleSignal(signal)
        })
        sendSignal({
          channelId: currentChannelId.value,
          type: 'JOIN' as WebRTCSignalType,
          fromUserId: user.value.userId.toString()
        })
        maybeToast('stomp-reconnect', 'Reconnected to voice', 'Re-syncing…')
      }
    }

    const prevOnWebSocketClose = client.onWebSocketClose
    client.onWebSocketClose = (evt) => {
      if (prevOnWebSocketClose) {
        try {
          prevOnWebSocketClose(evt)
        } catch {
          // ignore
        }
      }
      channelWebRTCSub = null
      userSignalSub = null
    }
    stompHandlersBound = true
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

  const pendingCandidates = ref<Map<string, RTCIceCandidateInit[]>>(new Map())

  const createPeerConnection = async (userId: string): Promise<RTCPeerConnection> => {
    const pc = new RTCPeerConnection(getRTCConfiguration())

    if (localStream.value) {
      localStream.value.getTracks().forEach((track) => {
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
            sender.setParameters(params).catch(err => console.warn('Failed to set audio encoding params:', err))
          }
        }
      })
    }

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams

      if (remoteStream) {
        let audio = peers.value.get(userId)?.audioEl
        if (!audio) {
          audio = new Audio()
          audio.autoplay = true
        }
        audio.srcObject = remoteStream
        audio.play().catch(err => console.error('Error playing audio:', err))

        const { analyser, context } = setupAudioAnalyser(remoteStream)

        const existingPeer = peers.value.get(userId)
        if (existingPeer) {
          existingPeer.stream = remoteStream
          existingPeer.audioEl = audio
          existingPeer.analyser = analyser
          existingPeer.audioContext = context
          peers.value.set(userId, existingPeer)
        } else {
          peers.value.set(userId, { connection: pc, stream: remoteStream, audioEl: audio, analyser, audioContext: context })
        }
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
      if (pc.iceConnectionState === 'failed') {
        maybeToast('ice-restart', 'Voice connection unstable', 'Reconnecting…')
        await tryIceRestart(userId)
      } else if (pc.iceConnectionState === 'disconnected') {
        setTimeout(() => {
          if (pc.iceConnectionState === 'disconnected') {
            removePeer(userId)
          }
        }, 3000)
      } else if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        console.log(`Successfully connected to peer ${userId}`)
      }
    }

    pc.onconnectionstatechange = async () => {
      if (pc.connectionState === 'failed') {
        maybeToast('ice-restart', 'Voice connection unstable', 'Reconnecting…')
        await tryIceRestart(userId)
      } else if (pc.connectionState === 'disconnected') {
        setTimeout(() => {
          if (pc.connectionState === 'disconnected') {
            removePeer(userId)
          }
        }, 3000)
      } else if (pc.connectionState === 'connected') {
        console.log(`Peer connection established with user ${userId}`)
      }
    }

    return pc
  }

  const sendSignal = (signal: WebRTCSignalRequest) => {
    if (stompClient && stompClient.connected) {
      stompClient.publish({
        destination: '/app/webrtc/signal',
        body: JSON.stringify(signal)
      })
    } else {
      console.error('Cannot send signal - STOMP client not connected')
    }
  }

  const handleSignal = async (signal: WebRTCSignalResponse) => {
    if (!user.value) return

    const { type, fromUserId, data } = signal
    const myId = user.value.userId.toString()

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
            participants.value.push({
              userId: fromUserId,
              username: signal.fromUsername,
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
              console.log(`Creating offer to new peer ${fromUserId} (broadcast JOIN)`)
              await createOffer(fromUserId)
            }
          } else if (signal.toUserId === myId && currentChannelId.value) {
            const existingPeer = peers.value.get(fromUserId)
            if (shouldInitiateOffer(fromUserId) && !existingPeer) {
              console.log(`Creating offer to peer ${fromUserId} (direct JOIN response)`)
              await createOffer(fromUserId)
            } else if (!shouldInitiateOffer(fromUserId) && !existingPeer) {
              console.log(`Waiting for offer from peer ${fromUserId} (they should initiate)`)
            }
          }
          break

        case 'LEAVE':
          participants.value = participants.value.filter((p: VoiceParticipant) => p.userId !== fromUserId)
          removePeer(fromUserId)
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
      console.error('Error handling WebRTC signal:', error)
    }
  }

  const createOffer = async (userId: string) => {
    try {
      console.log(`Creating peer connection and offer for user ${userId}`)
      const pc = await createPeerConnection(userId)
      peers.value.set(userId, { connection: pc })

      const offer = await pc.createOffer({
        offerToReceiveAudio: true
      })
      await pc.setLocalDescription(offer)

      if (currentChannelId.value && user.value) {
        console.log(`Sending offer to user ${userId}`)
        sendSignal({
          channelId: currentChannelId.value,
          type: 'OFFER' as WebRTCSignalType,
          fromUserId: user.value.userId.toString(),
          toUserId: userId,
          data: offer
        })
      }
    } catch (error) {
      console.error(`Error creating offer for user ${userId}:`, error)
    }
  }

  const handleOffer = async (userId: string, offer: RTCSessionDescriptionInit) => {
    try {
      console.log(`Received offer from user ${userId}`)
      let pc = peers.value.get(userId)?.connection

      if (pc) {
        if (pc.signalingState !== 'stable') {
          console.warn(`Received offer from ${userId} but peer connection is in ${pc.signalingState} state. Recreating connection.`)
          removePeer(userId)
          pc = await createPeerConnection(userId)
          peers.value.set(userId, { connection: pc })
        }
      } else {
        pc = await createPeerConnection(userId)
        peers.value.set(userId, { connection: pc })
      }

      await pc.setRemoteDescription(new RTCSessionDescription(offer))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      const queued = pendingCandidates.value.get(userId) || []
      for (const c of queued) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(c))
        } catch (e) {
          console.warn('Failed to add queued ICE candidate after offer handling', e)
        }
      }
      pendingCandidates.value.delete(userId)

      if (currentChannelId.value && user.value) {
        console.log(`Sending answer to user ${userId}`)
        sendSignal({
          channelId: currentChannelId.value,
          type: 'ANSWER' as WebRTCSignalType,
          fromUserId: user.value.userId.toString(),
          toUserId: userId,
          data: answer
        })
      }
    } catch (error) {
      console.error(`Error handling offer from user ${userId}:`, error)
    }
  }

  const handleAnswer = async (userId: string, answer: RTCSessionDescriptionInit) => {
    try {
      console.log(`Received answer from user ${userId}`)
      const peer = peers.value.get(userId)
      if (peer) {
        if (peer.connection.signalingState !== 'have-local-offer') {
          console.warn(`Received answer from ${userId} but peer connection is in ${peer.connection.signalingState} state, expected 'have-local-offer'`)
          return
        }

        await peer.connection.setRemoteDescription(new RTCSessionDescription(answer))
        console.log(`Successfully set remote description for answer from user ${userId}`)

        const queued = pendingCandidates.value.get(userId) || []
        for (const c of queued) {
          try {
            await peer.connection.addIceCandidate(new RTCIceCandidate(c))
          } catch (e) {
            console.warn('Failed to add queued ICE candidate after answer handling', e)
          }
        }
        pendingCandidates.value.delete(userId)
      } else {
        console.warn(`Received answer from ${userId} but no peer connection exists`)
      }
    } catch (error) {
      console.error(`Error handling answer from user ${userId}:`, error)
    }
  }

  const handleIceCandidate = async (userId: string, candidate: RTCIceCandidateInit) => {
    try {
      const peer = peers.value.get(userId)
      if (peer && peer.connection.remoteDescription) {
        await peer.connection.addIceCandidate(new RTCIceCandidate(candidate))
      } else {
        const list = pendingCandidates.value.get(userId) || []
        list.push(candidate)
        pendingCandidates.value.set(userId, list)
        if (list.length > 100) {
          list.splice(0, list.length - 100)
        }
      }
    } catch (error) {
      console.error('Error handling ICE candidate:', error)
    }
  }

  const tryIceRestart = async (userId: string) => {
    const peer = peers.value.get(userId)
    if (!peer || !user.value || !currentChannelId.value) return
    const pc = peer.connection
    try {
      if (pc.signalingState === 'stable') {
        console.log(`Attempting ICE restart with peer ${userId}`)
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
        console.warn(`Cannot ICE-restart with ${userId}, signalingState=${pc.signalingState}`)
      }
    } catch (e) {
      console.error('ICE restart failed, removing peer', e)
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

  const joinVoiceChannel = async (channelId: number, client: Client) => {
    if (!user.value) return

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Your browser does not support microphone access. Please use a modern browser like Chrome, Firefox, or Edge.')
      }

      localStream.value = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 2
        },
        video: false
      })

      currentChannelId.value = channelId
      stompClient = client
      bindStompReconnectHandlers(client)

      const { analyser, context } = setupAudioAnalyser(localStream.value)
      localAnalyser = analyser
      localAudioContext = context

      speakingCheckInterval = setInterval(checkSpeaking, 100)

      participants.value.push({
        userId: user.value.userId.toString(),
        username: user.value.username,
        isMuted: false,
        isSpeaking: false
      })

      channelWebRTCSub = client.subscribe(`/topic/channels/${channelId}/webrtc`, (message: { body: string }) => {
        const signal = JSON.parse(message.body) as WebRTCSignalResponse
        handleSignal(signal)
      })

      userSignalSub = client.subscribe(`/user/queue/webrtc/signal`, (message: { body: string }) => {
        const signal = JSON.parse(message.body) as WebRTCSignalResponse
        handleSignal(signal)
      })

      sendSignal({
        channelId,
        type: 'JOIN' as WebRTCSignalType,
        fromUserId: user.value.userId.toString()
      })

      if (typeof window !== 'undefined') {
        beforeUnloadHandler = () => {
          try {
            leaveVoiceChannel()
          } catch {
            // best-effort cleanup
          }
        }
        window.addEventListener('beforeunload', beforeUnloadHandler)
      }
    } catch (error) {
      console.error('Error joining voice channel:', error)
      throw error
    }
  }

  const leaveVoiceChannel = () => {
    if (!user.value || !currentChannelId.value) return

    sendSignal({
      channelId: currentChannelId.value,
      type: 'LEAVE' as WebRTCSignalType,
      fromUserId: user.value.userId.toString()
    })

    if (speakingCheckInterval) {
      clearInterval(speakingCheckInterval)
      speakingCheckInterval = null
    }

    if (localAudioContext) {
      localAudioContext.close().catch(() => {})
      localAudioContext = null
      localAnalyser = null
    }

    if (signalSubscription) {
      signalSubscription.unsubscribe()
      signalSubscription = null
    }
    if (channelWebRTCSub) {
      channelWebRTCSub.unsubscribe()
      channelWebRTCSub = null
    }
    if (userSignalSub) {
      userSignalSub.unsubscribe()
      userSignalSub = null
    }

    peers.value.forEach((peer, userId) => {
      removePeer(userId)
    })
    peers.value.clear()

    if (localStream.value) {
      localStream.value.getTracks().forEach(track => track.stop())
      localStream.value = null
    }

    participants.value = []
    currentChannelId.value = null
    stompClient = null

    if (typeof window !== 'undefined' && beforeUnloadHandler) {
      window.removeEventListener('beforeunload', beforeUnloadHandler)
      beforeUnloadHandler = null
    }
  }

  const toggleMute = () => {
    if (localStream.value && user.value) {
      const audioTrack = localStream.value.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        isMuted.value = !audioTrack.enabled

        const userId = user.value.userId.toString()
        const selfParticipant = participants.value.find(p => p.userId === userId)
        if (selfParticipant) {
          selfParticipant.isMuted = isMuted.value
        }
      }
    }
  }

  const toggleDeafen = () => {
    isDeafened.value = !isDeafened.value

    if (isDeafened.value && !isMuted.value) {
      toggleMute()
    }

    peers.value.forEach((peer) => {
      if (peer.stream) {
        peer.stream.getAudioTracks().forEach((track) => {
          track.enabled = !isDeafened.value
        })
      }
    })
  }

  return {
    localStream: readonly(localStream),
    peers: readonly(peers),
    participants: readonly(participants),
    isMuted: readonly(isMuted),
    isDeafened: readonly(isDeafened),
    currentChannelId: readonly(currentChannelId),
    joinVoiceChannel,
    leaveVoiceChannel,
    toggleMute,
    toggleDeafen
  }
}
