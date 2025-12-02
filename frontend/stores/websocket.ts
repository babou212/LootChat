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
 * - Visibility-based reconnection
 * - Network status monitoring
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

    // Reconnection strategy - more aggressive settings
    reconnectConfig: {
      enabled: true,
      baseDelay: 1000, // 1 second
      maxDelay: 30000, // 30 seconds
      maxAttempts: 50, // Increased from 10 - keep trying longer
      backoffMultiplier: 1.3, // Slower backoff for more frequent retries
      jitterFactor: 0.3 // Add randomness to prevent thundering herd
    },

    // Subscriptions management
    subscriptions: new Map<string, SubscriptionConfig>(),

    // Message queue for offline resilience
    messageQueue: [] as QueuedMessage[],
    maxQueueSize: 100,

    // Connection promise for deduplication
    connectionPromise: null as Promise<void> | null,

    // Timers and intervals
    heartbeatCheckInterval: null as ReturnType<typeof setInterval> | null,
    reconnectTimeout: null as ReturnType<typeof setTimeout> | null,

    // Network and visibility state
    isOnline: true,
    isVisible: true
  }),

  getters: {
    isConnected: state =>
      state.connectionState === 'connected' && !!state.client?.connected,

    isConnecting: state =>
      state.connectionState === 'connecting' || state.connectionState === 'reconnecting',

    canReconnect: state =>
      state.reconnectConfig.enabled
      && state.metrics.reconnectAttempts < state.reconnectConfig.maxAttempts
      && state.isOnline,

    nextReconnectDelay: (state) => {
      const { baseDelay, maxDelay, backoffMultiplier, jitterFactor } = state.reconnectConfig
      const attempts = state.metrics.reconnectAttempts
      const baseCalculatedDelay = Math.min(
        baseDelay * Math.pow(backoffMultiplier, attempts),
        maxDelay
      )
      // Add jitter to prevent all clients reconnecting at once
      const jitter = baseCalculatedDelay * jitterFactor * Math.random()
      return Math.floor(baseCalculatedDelay + jitter)
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

      // Setup browser event listeners on first connect
      this._setupBrowserEventListeners()

      this.connectionPromise = new Promise((resolve, reject) => {
        try {
          // Clean up existing client
          this._cleanupClient()

          const wsUrl = this._getWebSocketUrl()

          // SockJS with optimized options
          const socket = new SockJS(`${wsUrl}/ws`, null, {
            // Transports to try, in order of preference
            // WebSocket is most efficient, xhr-streaming is reliable fallback
            transports: ['websocket', 'xhr-streaming', 'xhr-polling'],
            // Session ID length for server-side session management
            sessionId: 8,
            // Timeout for transport connections (dynamically calculated by default)
            timeout: 10000
          })

          this.client = new Client({
            webSocketFactory: () => socket as WebSocket,
            connectHeaders: {
              Authorization: `Bearer ${token}`
            },

            // Heartbeat configuration - must match server settings
            // Client sends heartbeat every 10s, expects server heartbeat every 10s
            heartbeatIncoming: 10000,
            heartbeatOutgoing: 10000,

            // Disable built-in reconnection (we handle it ourselves with better logic)
            reconnectDelay: 0,

            // Debug logging in development
            debug: (msg) => {
              if (import.meta.dev) {
                console.debug('[STOMP]', msg)
              }
            },

            // Connection lifecycle callbacks
            onConnect: () => {
              this._handleConnect()
              resolve()
            },

            onStompError: (frame) => {
              const errorMessage = frame.headers['message'] || 'STOMP connection failed'
              this._handleError('STOMP error', errorMessage)
              reject(new Error(errorMessage))
            },

            onWebSocketError: (event) => {
              console.error('[WebSocket] WebSocket error:', event)
              this._handleError('WebSocket error', 'Connection failed')
              reject(new Error('WebSocket connection failed'))
            },

            onDisconnect: (frame) => {
              console.log('[WebSocket] Disconnected:', frame)
              this._handleDisconnect()
            },

            onWebSocketClose: (event) => {
              console.log('[WebSocket] WebSocket closed:', {
                code: event.code,
                reason: event.reason,
                wasClean: event.wasClean
              })
              // Only handle if not already handled by onDisconnect
              if (this.connectionState === 'connected') {
                this._handleDisconnect()
              }
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
      // Clear any pending reconnection
      this._clearReconnectTimeout()

      // Temporarily disable reconnection during intentional disconnect
      const wasEnabled = this.reconnectConfig.enabled
      this.reconnectConfig.enabled = false

      if (this.client?.connected) {
        await this.client.deactivate()
      }

      this._cleanupClient()
      this._stopHeartbeatCheck()
      this.connectionState = 'disconnected'
      this.connectionPromise = null

      // Re-enable reconnection if it was enabled before
      // This allows automatic reconnection on next connect() call
      this.reconnectConfig.enabled = wasEnabled
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
        try {
          config.subscription.unsubscribe()
        } catch (error) {
          console.warn('[WebSocket] Error unsubscribing:', error)
        }
      }
      this.subscriptions.delete(id)
    },

    /**
     * Unsubscribe from all topics
     */
    unsubscribeAll(): void {
      this.subscriptions.forEach((config) => {
        if (config.subscription) {
          try {
            config.subscription.unsubscribe()
          } catch (error) {
            console.warn('[WebSocket] Error unsubscribing:', error)
          }
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
     * Attempt to reconnect with exponential backoff and jitter
     */
    async reconnect(): Promise<void> {
      if (!this.canReconnect || !this.token) {
        console.warn('[WebSocket] Cannot reconnect - max attempts reached, no token, or offline')
        return
      }

      // Clear any existing reconnect timeout
      this._clearReconnectTimeout()

      this.connectionState = 'reconnecting'
      this.metrics.reconnectAttempts++

      const delay = this.nextReconnectDelay
      console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.metrics.reconnectAttempts}/${this.reconnectConfig.maxAttempts})...`)

      // Wait before reconnecting
      await new Promise(resolve => setTimeout(resolve, delay))

      // Check if we should still reconnect (might have been disabled or connected elsewhere)
      if (!this.reconnectConfig.enabled || this.isConnected) {
        return
      }

      try {
        await this.connect(this.token)
        // Reset attempts on successful connection
        this.metrics.reconnectAttempts = 0
        console.log('[WebSocket] Reconnected successfully')
      } catch (error) {
        console.error('[WebSocket] Reconnection attempt failed:', error)
        // If reconnection failed and we can still retry, schedule another attempt
        if (this.canReconnect) {
          this.reconnectTimeout = setTimeout(() => {
            this.reconnect()
          }, this.nextReconnectDelay)
        } else {
          this._handleError('Max reconnection attempts reached', error)
        }
      }
    },

    /**
     * Force reconnection (resets attempt counter)
     */
    async forceReconnect(): Promise<void> {
      this.metrics.reconnectAttempts = 0
      await this.disconnect()
      if (this.token) {
        await this.connect(this.token)
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
      this._clearReconnectTimeout()
      this._stopHeartbeatCheck()
      this._removeBrowserEventListeners()

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
      console.log('[WebSocket] Successfully connected')
      this.connectionState = 'connected'
      this.connectionError = null
      this.connectionPromise = null

      this.metrics.connectedAt = new Date()
      this.metrics.lastHeartbeat = new Date()
      this.metrics.reconnectAttempts = 0
      this.reconnectConfig.enabled = true

      // Start heartbeat monitoring
      this._startHeartbeatCheck()

      // Resubscribe to all topics
      this._resubscribeAll()

      // Process queued messages
      this._processMessageQueue()
    },

    _handleDisconnect(): void {
      const wasConnected = this.connectionState === 'connected'
      this.connectionState = 'disconnected'
      this.metrics.disconnectedAt = new Date()
      this.metrics.totalDisconnects++
      this.connectionPromise = null

      // Stop heartbeat monitoring
      this._stopHeartbeatCheck()

      // Clear subscriptions but keep configurations
      this.subscriptions.forEach((config) => {
        config.subscription = undefined
      })

      // Attempt reconnection if enabled and we were previously connected
      if (this.reconnectConfig.enabled && this.token && wasConnected && this.isOnline) {
        console.log(`[WebSocket] Connection lost, attempting reconnect in ${this.nextReconnectDelay}ms...`)
        this.reconnectTimeout = setTimeout(() => {
          if (this.connectionState === 'disconnected' && this.token && this.isOnline) {
            this.reconnect()
          }
        }, this.nextReconnectDelay)
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

    _clearReconnectTimeout(): void {
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout)
        this.reconnectTimeout = null
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
      console.log(`[WebSocket] Resubscribing to ${this.subscriptions.size} topics...`)
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

      console.log(`[WebSocket] Processing ${this.messageQueue.length} queued messages...`)
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
    },

    /**
     * Start monitoring heartbeats to detect stale connections
     */
    _startHeartbeatCheck(): void {
      this._stopHeartbeatCheck()

      this.heartbeatCheckInterval = setInterval(() => {
        if (!this.metrics.lastHeartbeat) return

        const timeSinceLastHeartbeat = Date.now() - this.metrics.lastHeartbeat.getTime()
        if (timeSinceLastHeartbeat > 45000) {
          console.warn('[WebSocket] Connection appears stale, forcing reconnection...')
          this.forceReconnect()
        }
      }, 30000)
    },

    _stopHeartbeatCheck(): void {
      if (this.heartbeatCheckInterval) {
        clearInterval(this.heartbeatCheckInterval)
        this.heartbeatCheckInterval = null
      }
    },

    _setupBrowserEventListeners(): void {
      if (!import.meta.client) return

      document.addEventListener('visibilitychange', this._handleVisibilityChange)

      window.addEventListener('online', this._handleOnline)
      window.addEventListener('offline', this._handleOffline)

      window.addEventListener('beforeunload', this._handleBeforeUnload)

      this.isOnline = navigator.onLine
      this.isVisible = document.visibilityState === 'visible'
    },

    _removeBrowserEventListeners(): void {
      if (!import.meta.client) return

      document.removeEventListener('visibilitychange', this._handleVisibilityChange)
      window.removeEventListener('online', this._handleOnline)
      window.removeEventListener('offline', this._handleOffline)
      window.removeEventListener('beforeunload', this._handleBeforeUnload)
    },

    _handleVisibilityChange(): void {
      const store = useWebSocketStore()
      store.isVisible = document.visibilityState === 'visible'

      if (store.isVisible && store.token) {
        if (!store.isConnected && store.isOnline) {
          console.log('[WebSocket] Tab visible, checking connection...')
          store.forceReconnect()
        }
      }
    },

    _handleOnline(): void {
      const store = useWebSocketStore()
      console.log('[WebSocket] Network online')
      store.isOnline = true

      if (!store.isConnected && store.token) {
        store.metrics.reconnectAttempts = 0
        store.reconnect()
      }
    },

    _handleOffline(): void {
      const store = useWebSocketStore()
      console.log('[WebSocket] Network offline')
      store.isOnline = false

      store._clearReconnectTimeout()
    },

    _handleBeforeUnload(): void {
      const store = useWebSocketStore()
      store.reconnectConfig.enabled = false
      if (store.client?.connected) {
        store.client.deactivate()
      }
    }
  }
})
