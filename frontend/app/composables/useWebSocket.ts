import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import type { MessageResponse } from '~/utils/api'

export const useWebSocket = () => {
  const config = useRuntimeConfig()
  const apiBaseUrl = config.public.apiUrl || 'http://localhost:8080'

  let stompClient: Client | null = null
  const isConnected = ref(false)
  const connectionError = ref<string | null>(null)

  const connect = (token: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        // Create SockJS instance
        const socket = new SockJS(`${apiBaseUrl}/ws`)

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
      console.error('WebSocket is not connected')
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
      console.error('WebSocket is not connected')
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

  return {
    connect,
    disconnect,
    subscribeToChannel,
    subscribeToAllMessages,
    isConnected: readonly(isConnected),
    connectionError: readonly(connectionError),
    getClient: () => stompClient
  }
}
