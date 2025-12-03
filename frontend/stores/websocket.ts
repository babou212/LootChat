import { defineStore } from 'pinia'
import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs'
import SockJS from 'sockjs-client'

/**
 * WebSocket Store - Simplified STOMP WebSocket management
 *
 */

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

interface SubscriptionConfig {
  destination: string
  callback: (data: unknown) => void
  subscription?: StompSubscription
}

interface QueuedMessage {
  destination: string
  payload: unknown
}

export const useWebSocketStore = defineStore('websocket', () => {
  // State
  const client = shallowRef<Client | null>(null)
  const connectionState = ref<ConnectionState>('disconnected')
  const connectionError = ref<string | null>(null)
  const token = ref<string | null>(null)
  const subscriptions = ref(new Map<string, SubscriptionConfig>())
  const messageQueue = ref<QueuedMessage[]>([])
  const reconnectAttempts = ref(0)

  // Computed
  const isConnected = computed(() => connectionState.value === 'connected' && client.value?.connected === true)
  const isConnecting = computed(() => connectionState.value === 'connecting' || connectionState.value === 'reconnecting')

  /**
   * Get the WebSocket URL based on environment
   */
  function getWebSocketUrl(): string {
    if (import.meta.server) {
      const config = useRuntimeConfig()
      return config.public.apiUrl || 'http://localhost:8080'
    }

    const { hostname, protocol, host } = window.location
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:8080'
    }
    return `${protocol}//${host}`
  }

  /**
   * Connect to WebSocket server
   */
  async function connect(authToken: string): Promise<void> {
    if (isConnected.value) {
      return
    }

    token.value = authToken
    connectionState.value = 'connecting'
    connectionError.value = null

    return new Promise((resolve, reject) => {
      if (client.value) {
        try {
          client.value.deactivate()
        } catch {
          // Ignore cleanup errors
        }
      }

      const wsUrl = getWebSocketUrl()

      // Create STOMP client with SockJS
      const stompClient = new Client({
        // Use SockJS for WebSocket with fallbacks
        webSocketFactory: () => {
          return new SockJS(`${wsUrl}/ws`, null, {
            transports: ['websocket', 'xhr-streaming', 'xhr-polling'],
            timeout: 10000
          }) as WebSocket
        },

        connectHeaders: {
          Authorization: `Bearer ${authToken}`
        },

        // Heartbeat: client sends every 10s, expects server response within 10s
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,

        reconnectDelay: 5000,

        onConnect: () => {
          if (import.meta.dev) console.log('[WebSocket] Connected')
          connectionState.value = 'connected'
          connectionError.value = null
          reconnectAttempts.value = 0

          // Resubscribe to all topics
          resubscribeAll()

          // Process queued messages
          processMessageQueue()

          resolve()
        },

        onStompError: (frame) => {
          const error = frame.headers['message'] || 'STOMP error'
          console.error('[WebSocket] STOMP error:', error)
          connectionError.value = error
          reject(new Error(error))
        },

        // WebSocket error
        onWebSocketError: (event) => {
          console.error('[WebSocket] WebSocket error:', event)
          connectionError.value = 'Connection failed'
        },

        onDisconnect: () => {
          if (import.meta.dev) console.log('[WebSocket] Disconnected')
          if (connectionState.value === 'connected') {
            connectionState.value = 'reconnecting'
            reconnectAttempts.value++
          }
        },

        onWebSocketClose: (event) => {
          if (import.meta.dev) console.log('[WebSocket] WebSocket closed:', event.code, event.reason)
          subscriptions.value.forEach((config) => {
            config.subscription = undefined
          })
        },

        // Debug in development
        debug: import.meta.dev ? msg => console.debug('[STOMP]', msg) : undefined
      })

      client.value = stompClient
      stompClient.activate()
    })
  }

  /**
   * Disconnect from WebSocket server
   */
  async function disconnect(): Promise<void> {
    if (client.value) {
      await client.value.deactivate()
      client.value = null
    }
    connectionState.value = 'disconnected'
    token.value = null
    reconnectAttempts.value = 0
  }

  /**
   * Subscribe to a topic
   */
  function subscribe<T = unknown>(
    id: string,
    destination: string,
    callback: (data: T) => void
  ): StompSubscription | null {
    // Store subscription config for resubscription after reconnect
    subscriptions.value.set(id, {
      destination,
      callback: callback as (data: unknown) => void
    })

    // If connected, subscribe now
    if (isConnected.value && client.value) {
      return doSubscribe(id, destination, callback)
    }

    return null
  }

  /**
   * Internal: Actually subscribe to destination
   */
  function doSubscribe<T>(
    id: string,
    destination: string,
    callback: (data: T) => void
  ): StompSubscription | null {
    if (!client.value?.connected) return null

    try {
      const subscription = client.value.subscribe(destination, (message: IMessage) => {
        try {
          const data = JSON.parse(message.body) as T
          callback(data)
        } catch (error) {
          console.error(`[WebSocket] Error parsing message from ${destination}:`, error)
        }
      })

      // Store subscription reference
      const config = subscriptions.value.get(id)
      if (config) {
        config.subscription = subscription
      }

      return subscription
    } catch (error) {
      console.error(`[WebSocket] Failed to subscribe to ${destination}:`, error)
      return null
    }
  }

  /**
   * Unsubscribe from a topic
   */
  function unsubscribe(id: string): void {
    const config = subscriptions.value.get(id)
    if (config?.subscription) {
      try {
        config.subscription.unsubscribe()
      } catch {
        // Ignore unsubscribe errors
      }
    }
    subscriptions.value.delete(id)
  }

  /**
   * Unsubscribe from all topics
   */
  function unsubscribeAll(): void {
    subscriptions.value.forEach((config) => {
      if (config.subscription) {
        try {
          config.subscription.unsubscribe()
        } catch {
          // Ignore
        }
      }
    })
    subscriptions.value.clear()
  }

  /**
   * Send a message to a destination
   */
  function sendMessage(destination: string, payload: unknown): void {
    if (isConnected.value && client.value) {
      client.value.publish({
        destination,
        body: JSON.stringify(payload)
      })
    } else {
      // Queue message for later
      if (messageQueue.value.length < 100) {
        messageQueue.value.push({ destination, payload })
      }
    }
  }

  /**
   * Resubscribe to all stored subscriptions
   */
  function resubscribeAll(): void {
    if (import.meta.dev) console.log(`[WebSocket] Resubscribing to ${subscriptions.value.size} topics`)
    subscriptions.value.forEach((config, id) => {
      doSubscribe(id, config.destination, config.callback)
    })
  }

  /**
   * Process queued messages after reconnection
   */
  function processMessageQueue(): void {
    if (messageQueue.value.length === 0) return

    if (import.meta.dev) console.log(`[WebSocket] Processing ${messageQueue.value.length} queued messages`)
    const queue = [...messageQueue.value]
    messageQueue.value = []

    queue.forEach(({ destination, payload }) => {
      sendMessage(destination, payload)
    })
  }

  async function forceReconnect(): Promise<void> {
    if (!token.value) return

    reconnectAttempts.value = 0
    await disconnect()
    await connect(token.value)
  }

  /**
   * Refresh auth token
   */
  async function refreshToken(): Promise<void> {
    try {
      const response = await fetch('/api/auth/token')
      if (!response.ok) {
        throw new Error('Failed to fetch auth token')
      }
      const data = await response.json() as { token: string }
      token.value = data.token
    } catch (error) {
      console.error('[WebSocket] Token refresh failed:', error)
      throw error
    }
  }

  /**
   * Reset store state
   */
  function reset(): void {
    unsubscribeAll()
    if (client.value) {
      try {
        client.value.deactivate()
      } catch {
        // Ignore
      }
      client.value = null
    }
    connectionState.value = 'disconnected'
    connectionError.value = null
    token.value = null
    messageQueue.value = []
    reconnectAttempts.value = 0
  }

  // Browser event handlers for visibility/online status
  if (import.meta.client) {
    // Reconnect when tab becomes visible
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && token.value && !isConnected.value && connectionState.value !== 'connecting') {
        if (import.meta.dev) console.log('[WebSocket] Tab visible, reconnecting...')
        forceReconnect()
      }
    })

    // Reconnect when coming back online
    window.addEventListener('online', () => {
      if (token.value && !isConnected.value) {
        if (import.meta.dev) console.log('[WebSocket] Network online, reconnecting...')
        forceReconnect()
      }
    })

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      if (client.value) {
        client.value.deactivate()
      }
    })
  }

  return {
    client,
    connectionState,
    connectionError,
    token,
    reconnectAttempts,
    isConnected,
    isConnecting,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    unsubscribeAll,
    sendMessage,
    forceReconnect,
    refreshToken,
    reset
  }
})
