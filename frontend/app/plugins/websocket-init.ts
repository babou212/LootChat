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
  }, { immediate: true })

  // Handle page navigation away
  nuxtApp.hook('page:finish', async () => {
    // Cleanup handled by component unmount
  })

  // Expose wsStore to nuxtApp for debugging
  if (import.meta.dev) {
    nuxtApp.$wsStore = wsStore
  }
})
