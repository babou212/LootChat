import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import type { MessageResponse } from '~/api/messageApi'
import type { Reaction } from '~/../../shared/types/chat'

interface MessageDeletionPayload {
  id: number
  channelId?: number | null
}

export interface UserPresenceUpdate {
  userId: number
  username: string
  status: 'online' | 'offline'
}

export const useWebSocket = () => {
  const config = useRuntimeConfig()

  // For WebSocket connections from the browser, we need to use the host's URL
  // WebSocket should go through nginx proxy, not directly to backend
  const getWebSocketUrl = () => {
    if (import.meta.client) {
      // Running in browser - use same host as the page (nginx will proxy to backend)
      const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:'
      const host = window.location.host // includes port if non-standard
      return `${protocol}//${host}`
    }
    // Server-side (shouldn't be used for WebSocket, but fallback)
    return config.public.apiUrl || 'http://localhost:8080'
  }

  let stompClient: Client | null = null
  const isConnected = ref(false)
  const connectionError = ref<string | null>(null)

  const connect = (token: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = getWebSocketUrl()
        // Create SockJS instance
        const socket = new SockJS(`${wsUrl}/ws`)

        // Create STOMP client
        stompClient = new Client({
          webSocketFactory: () => socket as WebSocket,
          connectHeaders: {
            Authorization: `Bearer ${token}`
          },
          reconnectDelay: 5000,
          heartbeatIncoming: 4000,
          heartbeatOutgoing: 4000,
          onConnect: () => {
            isConnected.value = true
            connectionError.value = null
            resolve()
          },
          onStompError: (frame) => {
            console.error('STOMP error:', frame)
            connectionError.value = frame.headers['message'] || 'Unknown error'
            isConnected.value = false
            reject(new Error(frame.headers['message'] || 'WebSocket connection failed'))
          },
          onWebSocketError: (event) => {
            console.error('WebSocket error:', event)
            connectionError.value = 'WebSocket connection error'
            isConnected.value = false
            reject(new Error('WebSocket connection error'))
          },
          onDisconnect: () => {
            isConnected.value = false
          }
        })

        // Activate the client
        stompClient.activate()
      } catch (error) {
        console.error('Error creating WebSocket connection:', error)
        connectionError.value = 'Failed to create WebSocket connection'
        reject(error)
      }
    })
  }

  const disconnect = () => {
    if (stompClient) {
      stompClient.deactivate()
      stompClient = null
      isConnected.value = false
    }
  }

  const subscribeToChannel = (channelId: number, callback: (message: MessageResponse) => void) => {
    if (!stompClient || !isConnected.value) {
      // console.error('WebSocket is not connected')
      return null
    }

    const subscription = stompClient.subscribe(
      `/topic/channels/${channelId}/messages`,
      (message) => {
        try {
          const parsedMessage = JSON.parse(message.body) as MessageResponse
          callback(parsedMessage)
        } catch (error) {
          console.error('Error parsing message:', error)
        }
      }
    )

    return subscription
  }

  const subscribeToAllMessages = (callback: (message: MessageResponse) => void) => {
    if (!stompClient || !isConnected.value) {
      // console.error('WebSocket is not connected')
      return null
    }

    const subscription = stompClient.subscribe(
      '/topic/messages',
      (message) => {
        try {
          const parsedMessage = JSON.parse(message.body) as MessageResponse
          callback(parsedMessage)
        } catch (error) {
          console.error('Error parsing message:', error)
        }
      }
    )

    return subscription
  }

  const subscribeToUserPresence = (callback: (update: UserPresenceUpdate) => void) => {
    if (!stompClient || !isConnected.value) {
      // console.error('WebSocket is not connected')
      return null
    }

    const subscription = stompClient.subscribe(
      '/topic/user-presence',
      (message) => {
        try {
          const update = JSON.parse(message.body) as UserPresenceUpdate
          callback(update)
        } catch (error) {
          console.error('Error parsing user presence update:', error)
        }
      }
    )

    return subscription
  }

  const subscribeToReactions = (callback: (reaction: Reaction) => void) => {
    if (!stompClient || !isConnected.value) {
      // console.error('WebSocket is not connected')
      return null
    }

    const subscription = stompClient.subscribe(
      '/topic/reactions',
      (message) => {
        try {
          const reaction = JSON.parse(message.body) as Reaction
          callback(reaction)
        } catch (error) {
          console.error('Error parsing reaction:', error)
        }
      }
    )

    return subscription
  }

  const subscribeToReactionRemovals = (callback: (reaction: Reaction) => void) => {
    if (!stompClient || !isConnected.value) {
      // console.error('WebSocket is not connected')
      return null
    }

    const subscription = stompClient.subscribe(
      '/topic/reactions/remove',
      (message) => {
        try {
          const reaction = JSON.parse(message.body) as Reaction
          callback(reaction)
        } catch (error) {
          console.error('Error parsing reaction removal:', error)
        }
      }
    )

    return subscription
  }

  const subscribeToChannelReactions = (channelId: number, callback: (reaction: Reaction) => void) => {
    if (!stompClient || !isConnected.value) {
      // console.error('WebSocket is not connected')
      return null
    }

    const subscription = stompClient.subscribe(
      `/topic/channels/${channelId}/reactions`,
      (message) => {
        try {
          const reaction = JSON.parse(message.body) as Reaction
          callback(reaction)
        } catch (error) {
          console.error('Error parsing channel reaction:', error)
        }
      }
    )

    return subscription
  }

  const subscribeToChannelReactionRemovals = (channelId: number, callback: (reaction: Reaction) => void) => {
    if (!stompClient || !isConnected.value) {
      // console.error('WebSocket is not connected')
      return null
    }

    const subscription = stompClient.subscribe(
      `/topic/channels/${channelId}/reactions/remove`,
      (message) => {
        try {
          const reaction = JSON.parse(message.body) as Reaction
          callback(reaction)
        } catch (error) {
          console.error('Error parsing channel reaction removal:', error)
        }
      }
    )

    return subscription
  }

  const subscribeToGlobalMessageDeletions = (callback: (payload: MessageDeletionPayload) => void) => {
    if (!stompClient || !isConnected.value) {
      // console.error('WebSocket is not connected')
      return null
    }
    const subscription = stompClient.subscribe(
      '/topic/messages/delete',
      (message) => {
        try {
          const payload = JSON.parse(message.body) as MessageDeletionPayload
          callback(payload)
        } catch (error) {
          console.error('Error parsing deletion payload:', error)
        }
      }
    )
    return subscription
  }

  const subscribeToChannelMessageDeletions = (channelId: number, callback: (payload: MessageDeletionPayload) => void) => {
    if (!stompClient || !isConnected.value) {
      // console.error('WebSocket is not connected')
      return null
    }
    const subscription = stompClient.subscribe(
      `/topic/channels/${channelId}/messages/delete`,
      (message) => {
        try {
          const payload = JSON.parse(message.body) as MessageDeletionPayload
          callback(payload)
        } catch (error) {
          console.error('Error parsing channel deletion payload:', error)
        }
      }
    )
    return subscription
  }

  return {
    connect,
    disconnect,
    subscribeToChannel,
    subscribeToAllMessages,
    subscribeToUserPresence,
    subscribeToReactions,
    subscribeToReactionRemovals,
    subscribeToChannelReactions,
    subscribeToChannelReactionRemovals,
    subscribeToGlobalMessageDeletions,
    subscribeToChannelMessageDeletions,
    isConnected: readonly(isConnected),
    connectionError: readonly(connectionError),
    getClient: () => stompClient
  }
}
