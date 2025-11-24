import { defineStore } from 'pinia'

export const useWebSocketStore = defineStore('websocket', {
  state: () => ({
    token: null as string | null,
    isConnected: false,
    connectionAttempts: 0,
    maxRetries: 3
  }),

  getters: {
    hasToken: state => !!state.token,
    canRetry: state => state.connectionAttempts < state.maxRetries
  },

  actions: {
    async fetchToken() {
      try {
        const response = await fetch('/api/auth/token')
        if (!response.ok) {
          throw new Error('Failed to fetch auth token')
        }

        const data = await response.json() as { token: string }
        this.token = data.token
        return this.token
      } catch (error) {
        console.error('Failed to fetch auth token:', error)
        this.token = null
        return null
      }
    },

    setConnected(connected: boolean) {
      this.isConnected = connected
      if (connected) {
        this.connectionAttempts = 0
      }
    },

    incrementConnectionAttempts() {
      this.connectionAttempts++
    },

    resetConnectionAttempts() {
      this.connectionAttempts = 0
    },

    clearToken() {
      this.token = null
    },

    reset() {
      this.token = null
      this.isConnected = false
      this.connectionAttempts = 0
    }
  }
})
