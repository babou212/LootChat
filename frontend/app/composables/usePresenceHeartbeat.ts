/**
 * Presence Heartbeat Composable
 *
 * Sends periodic heartbeats to keep the user's presence alive in the backend.
 * The backend's Redis TTL for presence is 5 minutes, so we send heartbeats
 * every 2 minutes to ensure the presence doesn't expire.
 */

const HEARTBEAT_INTERVAL = 2 * 60 * 1000 // 2 minutes

export const usePresenceHeartbeat = () => {
  const { user } = useAuth()

  let heartbeatTimer: ReturnType<typeof setInterval> | null = null
  let isActive = false

  const sendHeartbeat = async () => {
    if (!user.value) return

    try {
      await $fetch('/api/users/presence/heartbeat', {
        method: 'POST'
      })
    } catch (error) {
      // Silently fail - heartbeat failures shouldn't impact user experience
      console.warn('[Presence] Heartbeat failed:', error)
    }
  }

  const startHeartbeat = () => {
    if (isActive || !user.value) return

    isActive = true

    // Send initial heartbeat
    sendHeartbeat()

    // Set up periodic heartbeat
    heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL)

    console.log('[Presence] Heartbeat started')
  }

  const stopHeartbeat = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
    isActive = false
    console.log('[Presence] Heartbeat stopped')
  }

  // Handle page visibility changes
  const handleVisibilityChange = () => {
    if (document.hidden) {
      // Page is hidden, stop heartbeat to save resources
      stopHeartbeat()
    } else {
      // Page is visible again, restart heartbeat
      startHeartbeat()
    }
  }

  // Start heartbeat when composable is used
  onMounted(() => {
    if (user.value) {
      startHeartbeat()
    }

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange)
  })

  // Watch for auth changes
  watch(user, (newUser, oldUser) => {
    if (newUser && !oldUser) {
      startHeartbeat()
    } else if (!newUser && oldUser) {
      stopHeartbeat()
    }
  })

  // Cleanup on unmount
  onUnmounted(() => {
    stopHeartbeat()
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  })

  return {
    startHeartbeat,
    stopHeartbeat,
    sendHeartbeat
  }
}
