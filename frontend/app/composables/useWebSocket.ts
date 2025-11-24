import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import type { MessageResponse } from '~/api/messageApi'
import type { DirectMessageMessageResponse } from '~/api/directMessageApi'
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

// Shared global state for WebSocket connection
const globalWebSocketState = {
  stompClient: null as Client | null,
  isConnected: ref(false),
  connectionError: ref<string | null>(null)
}

export const useWebSocket = () => {
  const config = useRuntimeConfig()

  // For WebSocket connections from the browser, we need to connect to the backend
  const getWebSocketUrl = () => {
    if (import.meta.client) {
      // Running in browser
      // In development, connect directly to backend on localhost:8080
      // In production, use the same host (nginx will proxy to backend)
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:8080'
      }
      const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:'
      const host = window.location.host
      return `${protocol}//${host}`
    }
    // Server-side (shouldn't be used for WebSocket, but fallback)
    return config.public.apiUrl || 'http://localhost:8080'
  }

  const isConnected = globalWebSocketState.isConnected
  const connectionError = globalWebSocketState.connectionError

  const connect = (token: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = getWebSocketUrl()
        // Create SockJS instance
        const socket = new SockJS(`${wsUrl}/ws`)

        // Create STOMP client
        globalWebSocketState.stompClient = new Client({
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
        globalWebSocketState.stompClient?.activate()
      } catch (error) {
        console.error('Error creating WebSocket connection:', error)
        connectionError.value = 'Failed to create WebSocket connection'
        reject(error)
      }
    })
  }

  const disconnect = () => {
    if (globalWebSocketState.stompClient) {
      globalWebSocketState.stompClient.deactivate()
      globalWebSocketState.stompClient = null
      isConnected.value = false
    }
  }

  const subscribeToChannel = (channelId: number, callback: (message: MessageResponse) => void) => {
    if (!globalWebSocketState.stompClient || !isConnected.value) {
      console.warn(`Cannot subscribe to channel ${channelId} - WebSocket not connected`)
      return null
    }

    const subscription = globalWebSocketState.stompClient.subscribe(
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
    if (!globalWebSocketState.stompClient || !isConnected.value) {
      // console.error('WebSocket is not connected')
      return null
    }

    const subscription = globalWebSocketState.stompClient.subscribe(
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
    if (!globalWebSocketState.stompClient || !isConnected.value) {
      // console.error('WebSocket is not connected')
      return null
    }

    const subscription = globalWebSocketState.stompClient.subscribe(
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
    if (!globalWebSocketState.stompClient || !isConnected.value) {
      // console.error('WebSocket is not connected')
      return null
    }

    const subscription = globalWebSocketState.stompClient.subscribe(
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
    if (!globalWebSocketState.stompClient || !isConnected.value) {
      // console.error('WebSocket is not connected')
      return null
    }

    const subscription = globalWebSocketState.stompClient.subscribe(
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
    if (!globalWebSocketState.stompClient || !isConnected.value) {
      // console.error('WebSocket is not connected')
      return null
    }

    const subscription = globalWebSocketState.stompClient.subscribe(
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
    if (!globalWebSocketState.stompClient || !isConnected.value) {
      // console.error('WebSocket is not connected')
      return null
    }

    const subscription = globalWebSocketState.stompClient.subscribe(
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
    if (!globalWebSocketState.stompClient || !isConnected.value) {
      // console.error('WebSocket is not connected')
      return null
    }
    const subscription = globalWebSocketState.stompClient.subscribe(
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
    if (!globalWebSocketState.stompClient || !isConnected.value) {
      // console.error('WebSocket is not connected')
      return null
    }
    const subscription = globalWebSocketState.stompClient.subscribe(
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

  const subscribeToUserDirectMessages = (userId: number, callback: (message: DirectMessageMessageResponse) => void) => {
    if (!globalWebSocketState.stompClient || !isConnected.value) {
      return null
    }

    const subscription = globalWebSocketState.stompClient.subscribe(
      `/topic/user/${userId}/direct-messages`,
      (message) => {
        try {
          const dmMessage = JSON.parse(message.body) as DirectMessageMessageResponse
          callback(dmMessage)
        } catch (error) {
          console.error('Error parsing direct message:', error)
        }
      }
    )

    return subscription
  }

  const subscribeToDirectMessageReactions = (userId: number, directMessageId: number, callback: (reaction: { id: number, emoji: string, userId: number, username: string, messageId: number, createdAt: string }) => void) => {
    if (!globalWebSocketState.stompClient || !isConnected.value) {
      return null
    }

    const subscription = globalWebSocketState.stompClient.subscribe(
      `/topic/user/${userId}/direct-messages/${directMessageId}/reactions`,
      (message) => {
        try {
          const reaction = JSON.parse(message.body) as { id: number, emoji: string, userId: number, username: string, messageId: number, createdAt: string }
          callback(reaction)
        } catch (error) {
          console.error('Error parsing DM reaction:', error)
        }
      }
    )

    return subscription
  }

  const subscribeToDirectMessageReactionRemovals = (userId: number, directMessageId: number, callback: (reaction: { id: number, messageId: number }) => void) => {
    if (!globalWebSocketState.stompClient || !isConnected.value) {
      return null
    }

    const subscription = globalWebSocketState.stompClient.subscribe(
      `/topic/user/${userId}/direct-messages/${directMessageId}/reactions/remove`,
      (message) => {
        try {
          const reaction = JSON.parse(message.body) as { id: number, messageId: number }
          callback(reaction)
        } catch (error) {
          console.error('Error parsing DM reaction removal:', error)
        }
      }
    )

    return subscription
  }

  const subscribeToDirectMessageEdits = (userId: number, directMessageId: number, callback: (message: DirectMessageMessageResponse) => void) => {
    if (!globalWebSocketState.stompClient || !isConnected.value) {
      return null
    }

    const subscription = globalWebSocketState.stompClient.subscribe(
      `/topic/user/${userId}/direct-messages/${directMessageId}/edits`,
      (message) => {
        try {
          const editedMessage = JSON.parse(message.body) as DirectMessageMessageResponse
          callback(editedMessage)
        } catch (error) {
          console.error('Error parsing DM edit:', error)
        }
      }
    )

    return subscription
  }

  const subscribeToDirectMessageDeletions = (directMessageId: number, callback: (payload: { id: number }) => void) => {
    if (!globalWebSocketState.stompClient || !isConnected.value) {
      return null
    }

    const subscription = globalWebSocketState.stompClient.subscribe(
      `/topic/direct-messages/${directMessageId}/delete`,
      (message) => {
        try {
          const payload = JSON.parse(message.body) as { id: number }
          callback(payload)
        } catch (error) {
          console.error('Error parsing DM deletion:', error)
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
    subscribeToUserDirectMessages,
    subscribeToDirectMessageReactions,
    subscribeToDirectMessageReactionRemovals,
    subscribeToDirectMessageEdits,
    subscribeToDirectMessageDeletions,
    isConnected: readonly(isConnected),
    connectionError: readonly(connectionError),
    getClient: () => globalWebSocketState.stompClient
  }
}
