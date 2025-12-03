import type { LoginRequest, User } from '../../../shared/types/user'
import { useAuthStore } from '../../../stores/auth'
import { useChannelsStore } from '../../../stores/channels'
import { useMessagesStore } from '../../../stores/messages'
import { useDirectMessagesStore } from '../../../stores/directMessages'
import { useUsersStore } from '../../../stores/users'
import { useAvatarStore } from '../../../stores/avatars'
import { useComposerStore } from '../../../stores/composer'
import { useWebSocketStore } from '../../../stores/websocket'
import { useLiveKitStore } from '../../../stores/livekit'

/**
 * Authentication composable
 *
 * - Session managed by nuxt-auth-utils in HTTP-only cookies (7 day expiry)
 * - JWT tokens stored in session for backend API calls
 * - Tokens auto-refreshed by server middleware and client plugin
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
        body: credentials
      })

      if (response.success && response.user) {
        await refreshSession()
        if (user.value) authStore.setUser(user.value)
        return { success: true }
      }

      error.value = 'Login failed'
      return { success: false, message: 'Login failed' }
    } catch (err: unknown) {
      error.value = (err as { data?: { message?: string } })?.data?.message || 'Invalid credentials'
      return { success: false, message: error.value }
    } finally {
      loading.value = false
    }
  }

  const logout = async () => {
    loading.value = true
    try {
      await $fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // Continue with logout even on error
    }

    await clear()
    clearAllStores()
    loading.value = false
    error.value = null
  }

  const clearAllStores = () => {
    authStore.clear()
    useChannelsStore().clearChannels()
    useChannelsStore().resetUnreadState()
    useMessagesStore().clearAllCaches()
    useDirectMessagesStore().clearAll()
    useUsersStore().clearUsers()
    useAvatarStore().clearAvatars()
    useComposerStore().reset()
    useWebSocketStore().disconnect()
    useWebSocketStore().reset()
    useLiveKitStore().reset()

    if (import.meta.client) {
      sessionStorage.clear()
      // Clear localStorage except color-mode
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i)
        if (key && !key.includes('color-mode')) {
          localStorage.removeItem(key)
        }
      }
    }
  }

  const refreshToken = async (): Promise<boolean> => {
    try {
      await $fetch('/api/auth/refresh', { method: 'POST' })
      await refreshSession()
      return true
    } catch {
      await clear()
      clearAllStores()
      return false
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
