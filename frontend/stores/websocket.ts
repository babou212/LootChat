import { defineStore } from 'pinia'
import { Client, type StompSubscription } from '@stomp/stompjs'
import SockJS from 'sockjs-client'

/**
 * Enhanced WebSocket Store - Centralized connection management
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Connection quality monitoring
 * - Subscription lifecycle management
 * - Message queue for offline resilience
 * - Comprehensive error handling
 * - Connection state history
 */

export type ConnectionState
  = | 'disconnected'
    | 'connecting'
    | 'connected'
    | 'reconnecting'
    | 'error'

export interface ConnectionMetrics {
  connectedAt?: Date
  disconnectedAt?: Date
  lastHeartbeat?: Date
  reconnectAttempts: number
  totalDisconnects: number
  averageLatency?: number
  messagesSent: number
  messagesReceived: number
}

export interface QueuedMessage {
  id: string
  destination: string
  payload: unknown
  timestamp: Date
  attempts: number
}

export interface SubscriptionConfig {
  id: string
  destination: string
  callback: (data: unknown) => void
  subscription?: StompSubscription
  subscribeOnConnect: boolean
}

export const useWebSocketStore = defineStore('websocket', {
  state: () => ({
    // Connection state
    client: null as Client | null,
    connectionState: 'disconnected' as ConnectionState,
    connectionError: null as string | null,
    token: null as string | null,

    // Connection metrics
    metrics: {
      connectedAt: undefined,
      disconnectedAt: undefined,
      lastHeartbeat: undefined,
      reconnectAttempts: 0,
      totalDisconnects: 0,
      averageLatency: undefined,
      messagesSent: 0,
      messagesReceived: 0
    } as ConnectionMetrics,

    // Reconnection strategy
    reconnectConfig: {
      enabled: true,
      baseDelay: 1000, // 1 second
      maxDelay: 30000, // 30 seconds
      maxAttempts: 10,
      backoffMultiplier: 1.5
    },

    // Subscriptions management
    subscriptions: new Map<string, SubscriptionConfig>(),

    // Message queue for offline resilience
    messageQueue: [] as QueuedMessage[],
    maxQueueSize: 100,

    // Connection promise for deduplication
    connectionPromise: null as Promise<void> | null
  }),

  getters: {
    isConnected: state =>
      state.connectionState === 'connected' && !!state.client?.connected,

    isConnecting: state =>
      state.connectionState === 'connecting' || state.connectionState === 'reconnecting',

    canReconnect: state =>
      state.reconnectConfig.enabled
      && state.metrics.reconnectAttempts < state.reconnectConfig.maxAttempts,

    nextReconnectDelay: (state) => {
      const { baseDelay, maxDelay, backoffMultiplier } = state.reconnectConfig
      const attempts = state.metrics.reconnectAttempts
      const delay = Math.min(
        baseDelay * Math.pow(backoffMultiplier, attempts),
        maxDelay
      )
      return delay
    },

    connectionQuality: (state) => {
      if (!state.client?.connected) return 'disconnected'

      const { reconnectAttempts, averageLatency } = state.metrics

      if (reconnectAttempts === 0 && (!averageLatency || averageLatency < 100)) {
        return 'excellent'
      }
      if (reconnectAttempts < 3 && (!averageLatency || averageLatency < 300)) {
        return 'good'
      }
      return 'poor'
    },

    activeSubscriptions: state =>
      Array.from(state.subscriptions.keys()),

    queuedMessageCount: state =>
      state.messageQueue.length
  },

  actions: {
    /**
     * Initialize WebSocket connection with authentication token
     */
    async connect(token: string): Promise<void> {
      // Prevent duplicate connection attempts
      if (this.isConnected) {
        return Promise.resolve()
      }

      // Return existing connection promise if already connecting
      if (this.connectionPromise) {
        return this.connectionPromise
      }

      this.token = token
      this.connectionState = 'connecting'
      this.connectionError = null

      this.connectionPromise = new Promise((resolve, reject) => {
        try {
          // Clean up existing client
          this._cleanupClient()

          const wsUrl = this._getWebSocketUrl()
          const socket = new SockJS(`${wsUrl}/ws`)

          this.client = new Client({
            webSocketFactory: () => socket as WebSocket,
            connectHeaders: {
              Authorization: `Bearer ${token}`
            },

            // Heartbeat configuration
            heartbeatIncoming: 10000,
            heartbeatOutgoing: 10000,

            // Disable built-in reconnection (we handle it ourselves)
            reconnectDelay: 0,

            // Connection lifecycle callbacks
            onConnect: () => {
              this._handleConnect()
              resolve()
            },

            onStompError: (frame) => {
              this._handleError('STOMP error', frame.headers['message'])
              reject(new Error(frame.headers['message'] || 'STOMP connection failed'))
            },

            onWebSocketError: () => {
              this._handleError('WebSocket error', 'Connection failed')
              reject(new Error('WebSocket connection failed'))
            },

            onDisconnect: () => {
              this._handleDisconnect()
            },

            // Track heartbeats for latency
            onWebSocketClose: () => {
              this._handleDisconnect()
            }
          })

          this.client.activate()
        } catch (error) {
          this._handleError('Connection initialization failed', error)
          this.connectionPromise = null
          reject(error)
        }
      })

      return this.connectionPromise
    },

    /**
     * Gracefully disconnect from WebSocket
     */
    async disconnect(): Promise<void> {
      this.reconnectConfig.enabled = false

      if (this.client?.connected) {
        await this.client.deactivate()
      }

      this._cleanupClient()
      this.connectionState = 'disconnected'
      this.connectionPromise = null
    },

    /**
     * Subscribe to a WebSocket topic with automatic resubscription
     */
    subscribe<T = unknown>(
      id: string,
      destination: string,
      callback: (data: T) => void,
      subscribeOnConnect = true
    ): StompSubscription | null {
      // Store subscription configuration
      this.subscriptions.set(id, {
        id,
        destination,
        callback: callback as (data: unknown) => void,
        subscribeOnConnect
      })

      // If connected, subscribe immediately
      if (this.isConnected && this.client) {
        return this._subscribeToDestination(id, destination, callback)
      }

      // Otherwise, will auto-subscribe on connection
      return null
    },

    /**
     * Unsubscribe from a topic
     */
    unsubscribe(id: string): void {
      const config = this.subscriptions.get(id)
      if (config?.subscription) {
        config.subscription.unsubscribe()
      }
      this.subscriptions.delete(id)
    },

    /**
     * Unsubscribe from all topics
     */
    unsubscribeAll(): void {
      this.subscriptions.forEach((config) => {
        if (config.subscription) {
          config.subscription.unsubscribe()
        }
      })
      this.subscriptions.clear()
    },

    /**
     * Send message with queue fallback if disconnected
     */
    async sendMessage(destination: string, payload: unknown): Promise<void> {
      if (this.isConnected && this.client) {
        try {
          this.client.publish({
            destination,
            body: JSON.stringify(payload)
          })
          this.metrics.messagesSent++
        } catch (error) {
          this._queueMessage(destination, payload)
          throw error
        }
      } else {
        this._queueMessage(destination, payload)
        throw new Error('WebSocket not connected - message queued')
      }
    },

    /**
     * Attempt to reconnect with exponential backoff
     */
    async reconnect(): Promise<void> {
      if (!this.canReconnect || !this.token) {
        throw new Error('Cannot reconnect - max attempts reached or no token')
      }

      this.connectionState = 'reconnecting'
      this.metrics.reconnectAttempts++

      const delay = this.nextReconnectDelay

      // Wait before reconnecting
      await new Promise(resolve => setTimeout(resolve, delay))

      try {
        await this.connect(this.token)
        // Reset attempts on successful connection
        this.metrics.reconnectAttempts = 0
      } catch (error) {
        // If reconnection failed and we can still retry, schedule another attempt
        if (this.canReconnect) {
          setTimeout(() => this.reconnect(), this.nextReconnectDelay)
        } else {
          this._handleError('Max reconnection attempts reached', error)
        }
        throw error
      }
    },

    /**
     * Refresh authentication token
     */
    async refreshToken(): Promise<void> {
      try {
        const response = await fetch('/api/auth/token')
        if (!response.ok) {
          throw new Error('Failed to fetch auth token')
        }

        const data = await response.json() as { token: string }
        this.token = data.token

        // Reconnect with new token if we were connected
        if (this.connectionState !== 'disconnected') {
          await this.disconnect()
          await this.connect(this.token)
        }
      } catch (error) {
        this._handleError('Token refresh failed', error)
        throw error
      }
    },

    /**
     * Reset all metrics and state
     */
    reset(): void {
      this.unsubscribeAll()
      this._cleanupClient()

      this.connectionState = 'disconnected'
      this.connectionError = null
      this.token = null
      this.messageQueue = []

      this.metrics = {
        connectedAt: undefined,
        disconnectedAt: undefined,
        lastHeartbeat: undefined,
        reconnectAttempts: 0,
        totalDisconnects: 0,
        averageLatency: undefined,
        messagesSent: 0,
        messagesReceived: 0
      }
    },

    /**
     * PRIVATE METHODS
     */

    _getWebSocketUrl(): string {
      if (import.meta.client) {
        const { hostname, protocol, host } = window.location

        if (hostname === 'localhost' || hostname === '127.0.0.1') {
          return 'http://localhost:8080'
        }

        const wsProtocol = protocol === 'https:' ? 'https:' : 'http:'
        return `${wsProtocol}//${host}`
      }

      const config = useRuntimeConfig()
      return config.public.apiUrl || 'http://localhost:8080'
    },

    _handleConnect(): void {
      this.connectionState = 'connected'
      this.connectionError = null
      this.connectionPromise = null

      this.metrics.connectedAt = new Date()
      this.metrics.reconnectAttempts = 0

      // Resubscribe to all topics
      this._resubscribeAll()

      // Process queued messages
      this._processMessageQueue()
    },

    _handleDisconnect(): void {
      this.connectionState = 'disconnected'
      this.metrics.disconnectedAt = new Date()
      this.metrics.totalDisconnects++

      // Clear subscriptions but keep configurations
      this.subscriptions.forEach((config) => {
        config.subscription = undefined
      })

      // Attempt reconnection if enabled
      if (this.reconnectConfig.enabled && this.token) {
        setTimeout(() => this.reconnect(), this.nextReconnectDelay)
      }
    },

    _handleError(context: string, error: unknown): void {
      const message = error instanceof Error ? error.message : String(error)
      this.connectionError = `${context}: ${message}`
      this.connectionState = 'error'
      this.connectionPromise = null

      console.error(`[WebSocket] ${context}:`, error)
    },

    _cleanupClient(): void {
      if (this.client) {
        try {
          if (this.client.connected) {
            this.client.deactivate()
          }
        } catch (error) {
          console.warn('[WebSocket] Error during cleanup:', error)
        }
        this.client = null
      }
    },

    _subscribeToDestination<T>(
      id: string,
      destination: string,
      callback: (data: T) => void
    ): StompSubscription | null {
      if (!this.client?.connected) return null

      try {
        const subscription = this.client.subscribe(destination, (message) => {
          try {
            const data = JSON.parse(message.body) as T
            this.metrics.messagesReceived++
            this.metrics.lastHeartbeat = new Date()
            callback(data)
          } catch (error) {
            console.error(`[WebSocket] Error parsing message from ${destination}:`, error)
          }
        })

        // Update subscription in config
        const config = this.subscriptions.get(id)
        if (config) {
          config.subscription = subscription
        }

        return subscription
      } catch (error) {
        console.error(`[WebSocket] Failed to subscribe to ${destination}:`, error)
        return null
      }
    },

    _resubscribeAll(): void {
      this.subscriptions.forEach((config) => {
        if (config.subscribeOnConnect) {
          this._subscribeToDestination(
            config.id,
            config.destination,
            config.callback
          )
        }
      })
    },

    _queueMessage(destination: string, payload: unknown): void {
      if (this.messageQueue.length >= this.maxQueueSize) {
        // Remove oldest message
        this.messageQueue.shift()
      }

      this.messageQueue.push({
        id: `${Date.now()}-${Math.random()}`,
        destination,
        payload,
        timestamp: new Date(),
        attempts: 0
      })
    },

    _processMessageQueue(): void {
      if (!this.isConnected || this.messageQueue.length === 0) return

      const maxAttempts = 3
      const messagesToProcess = [...this.messageQueue]
      this.messageQueue = []

      messagesToProcess.forEach((msg) => {
        if (msg.attempts < maxAttempts) {
          this.sendMessage(msg.destination, msg.payload).catch(() => {
            msg.attempts++
            this.messageQueue.push(msg)
          })
        } else {
          console.error(`[WebSocket] Message dropped after ${maxAttempts} attempts:`, msg)
        }
      })
    }
  }
})
