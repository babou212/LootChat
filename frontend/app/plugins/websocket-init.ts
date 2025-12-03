import { useWebSocketStore } from '../../stores/websocket'

/**
 * WebSocket Auto-Connect Plugin
 *
 */
export default defineNuxtPlugin(async () => {
  const { user } = useAuth()
  const wsStore = useWebSocketStore()

  if (import.meta.server) return

  async function connectIfAuthenticated() {
    if (user.value && !wsStore.isConnected) {
      try {
        await wsStore.refreshToken()
        if (wsStore.token) {
          await wsStore.connect(wsStore.token)
        }
      } catch (error) {
        console.error('[WebSocket Plugin] Connection failed:', error)
      }
    }
  }

  await connectIfAuthenticated()

  watch(user, async (newUser, oldUser) => {
    if (newUser && !oldUser) {
      await connectIfAuthenticated()
    } else if (!newUser && oldUser) {
      wsStore.reset()
    }
  })
})
