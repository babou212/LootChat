import type { LoginRequest, User } from '../../shared/types/user'
import { useAuthStore } from '../../stores/auth'
import { useChannelsStore } from '../../stores/channels'
import { useMessagesStore } from '../../stores/messages'
import { useDirectMessagesStore } from '../../stores/directMessages'
import { useUsersStore } from '../../stores/users'
import { useUserPresenceStore } from '../../stores/userPresence'
import { useAvatarStore } from '../../stores/avatars'
import { useComposerStore } from '../../stores/composer'
import { useWebSocketStore } from '../../stores/websocket'

/**
 * Authentication composable using nuxt-auth-utils
 * Provides a clean interface for login, logout, and session management
 * All authentication state is managed server-side in secure HTTP-only cookies
 */
export const useAuth = () => {
  const { loggedIn, user, session, clear, fetch: refreshSession } = useUserSession()
  const authStore = useAuthStore()
  const loading = useState<boolean>('auth-loading', () => false)
  const error = useState<string | null>('auth-error', () => null)

  const login = async (credentials: LoginRequest) => {
    loading.value = true
    error.value = null

    try {
      const response = await $fetch<{ success: boolean, user: User }>('/api/auth/login', {
        method: 'POST',
        body: credentials,
        credentials: 'include'
      })

      if (response.success && response.user) {
        await refreshSession()

        if (user.value) {
          authStore.setUser(user.value)
        }

        return { success: true }
      } else {
        error.value = 'Login failed'
        return { success: false, message: 'Login failed' }
      }
    } catch (err: unknown) {
      const errorMessage = err && typeof err === 'object' && 'data' in err
        ? ((err as { data?: { message?: string } }).data?.message || 'Invalid credentials')
        : 'Invalid credentials'
      error.value = errorMessage
      return { success: false, message: error.value }
    } finally {
      loading.value = false
    }
  }

  const logout = async () => {
    loading.value = true
    try {
      await $fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      })

      await clear()

      // Clear all application stores and caches
      clearAllStores()

      error.value = null
    } catch (err) {
      console.error('Logout error:', err)
      await clear()
      // Still clear stores even on error
      clearAllStores()
    } finally {
      loading.value = false
    }
  }

  /**
   * Clear all application stores and caches on logout.
   * This ensures no user data persists after logout.
   */
  const clearAllStores = () => {
    // Get all store instances
    const channelsStore = useChannelsStore()
    const messagesStore = useMessagesStore()
    const directMessagesStore = useDirectMessagesStore()
    const usersStore = useUsersStore()
    const userPresenceStore = useUserPresenceStore()
    const avatarStore = useAvatarStore()
    const composerStore = useComposerStore()
    const websocketStore = useWebSocketStore()

    // Clear auth store
    authStore.clear()

    // Clear channels and unread state
    channelsStore.clearChannels()
    channelsStore.resetUnreadState()

    // Clear message caches
    messagesStore.clearAllCaches()

    // Clear direct messages
    directMessagesStore.clearAll()

    // Clear users
    usersStore.clearUsers()

    // Clear user presence
    userPresenceStore.clearPresence()

    // Clear avatar cache
    avatarStore.clearAvatars()

    // Reset composer
    composerStore.reset()

    // Disconnect and reset WebSocket
    websocketStore.disconnect()
    websocketStore.reset()
  }

  const restore = async () => {
    try {
      if (!user.value) {
        await refreshSession()
      }
    } catch {
      await clear()
      authStore.clear()
    }
  }

  return {
    user: computed(() => user.value),
    loading: readonly(loading),
    error: readonly(error),
    isAuthenticated: computed(() => loggedIn.value),
    session: computed(() => session.value),
    login,
    logout,
    restore,
    refreshSession
  }
}
