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
import { useLiveKitStore } from '../../stores/livekit'

/**
 * Authentication composable using nuxt-auth-utils
 * Provides a clean interface for login, logout, and session management
 * All authentication state is managed server-side in secure HTTP-only cookies
 *
 * Session/JWT Architecture:
 * - Session cookies are managed by nuxt-auth-utils (7 day expiry)
 * - JWT tokens are stored in the session and used for backend API calls
 * - JWT tokens are short-lived (15 minutes) for security
 * - Tokens are automatically refreshed by the auth-init plugin every 10 minutes
 * - Server middleware (auth-refresh.ts) validates JWT on each request
 */
export const useAuth = () => {
  const { loggedIn, user, session, clear, fetch: refreshSession } = useUserSession()
  const authStore = useAuthStore()
  const loading = useState<boolean>('auth-loading', () => false)
  const error = useState<string | null>('auth-error', () => null)
  const isRefreshing = useState<boolean>('auth-refreshing', () => false)

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
    const livekitStore = useLiveKitStore()

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

    // Disconnect and reset LiveKit
    livekitStore.reset()

    // Clear browser storage (client-side only)
    if (import.meta.client) {
      clearBrowserStorage()
    }
  }

  /**
   * Clear all browser storage (localStorage, sessionStorage, cookies)
   * This ensures no cached data remains after logout
   */
  const clearBrowserStorage = () => {
    try {
      // Clear sessionStorage completely
      sessionStorage.clear()

      // Clear localStorage items related to this app
      // We preserve some items like color-mode preference
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && !key.includes('color-mode')) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key))

      // Clear any app-related cookies from the client side
      // Note: HttpOnly cookies can only be cleared server-side
      const cookies = document.cookie.split(';')
      cookies.forEach((cookie) => {
        const cookieParts = cookie.split('=')
        const name = cookieParts[0]?.trim()
        // Don't clear color-mode cookie
        if (name && !name.includes('color-mode')) {
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
        }
      })
    } catch (e) {
      console.warn('[Auth] Failed to clear browser storage:', e)
    }
  }

  /**
   * Refresh the JWT token
   * Called when the token is about to expire
   */
  const refreshToken = async (): Promise<boolean> => {
    if (isRefreshing.value) return false
    isRefreshing.value = true

    try {
      await $fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include'
      })

      // Refresh the session to get updated user data
      await refreshSession()
      return true
    } catch {
      // Token refresh failed - session is invalid
      await clear()
      clearAllStores()
      return false
    } finally {
      isRefreshing.value = false
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
    refreshSession,
    refreshToken
  }
}
