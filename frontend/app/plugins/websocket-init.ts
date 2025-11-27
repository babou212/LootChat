import { useWebSocketStore } from '../../stores/websocket'

/**
 * WebSocket Auto-Connect Plugin
 *
 * Automatically establishes WebSocket connection when user is authenticated
 * Handles token refresh and reconnection on auth state changes
 */
export default defineNuxtPlugin(async (nuxtApp) => {
  const { user } = useAuth()
  const wsStore = useWebSocketStore()

  // Only run on client side
  if (import.meta.server) return

  // Check if user is already logged in on page load
  if (user.value && !wsStore.isConnected) {
    try {
      await wsStore.refreshToken()
      if (wsStore.token) {
        await wsStore.connect(wsStore.token)
      }
    } catch (error) {
      console.error('[WebSocket Plugin] Initial connection failed:', error)
      // Retry after delay
      setTimeout(async () => {
        try {
          if (user.value && !wsStore.isConnected) {
            await wsStore.refreshToken()
            if (wsStore.token) {
              await wsStore.connect(wsStore.token)
            }
          }
        } catch (retryError) {
          console.error('[WebSocket Plugin] Retry connection failed:', retryError)
        }
      }, 2000)
    }
  }

  // Watch for authentication changes
  watch(user, async (newUser, oldUser) => {
    if (newUser && !oldUser) {
      // User logged in - establish connection
      try {
        await wsStore.refreshToken()
        if (wsStore.token) {
          await wsStore.connect(wsStore.token)
        }
      } catch (error) {
        console.error('[WebSocket Plugin] Failed to connect:', error)
      }
    } else if (!newUser && oldUser) {
      // User logged out - disconnect
      await wsStore.disconnect()
      wsStore.reset()
    }
  })

  // Handle page visibility changes - reconnect when user returns to tab
  const handleVisibilityChange = async () => {
    if (!document.hidden && user.value && !wsStore.isConnected) {
      console.log('[WebSocket Plugin] Page visible, checking connection...')
      try {
        await wsStore.refreshToken()
        if (wsStore.token) {
          await wsStore.connect(wsStore.token)
        }
      } catch (error) {
        console.error('[WebSocket Plugin] Visibility reconnection failed:', error)
      }
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)

  // Cleanup on page leave
  if (import.meta.client) {
    window.addEventListener('beforeunload', () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    })
  }

  // Handle page navigation away
  nuxtApp.hook('page:finish', async () => {
    // Cleanup handled by component unmount
  })

  // Expose wsStore to nuxtApp for debugging
  if (import.meta.dev) {
    nuxtApp.$wsStore = wsStore
  }
})
