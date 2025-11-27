import type { LoginRequest, User } from '../../shared/types/user'
import { useAuthStore } from '../../stores/auth'

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

      authStore.clear()

      error.value = null
    } catch (err) {
      console.error('Logout error:', err)
      await clear()
      authStore.clear()
    } finally {
      loading.value = false
    }
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
