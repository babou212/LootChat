import type { LoginRequest, User } from '../../shared/types/user'

/**
 * Authentication composable using nuxt-auth-utils
 * Provides a clean interface for login, logout, and session management
 * All authentication state is managed server-side in secure HTTP-only cookies
 */
export const useAuth = () => {
  const { loggedIn, user, session, clear, fetch: refreshSession } = useUserSession()
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
        // Refresh the session to get the updated user data
        await refreshSession()
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

      // Clear the session on both client and server
      await clear()
      error.value = null
    } catch (err) {
      console.error('Logout error:', err)
      // Clear session even on error
      await clear()
    } finally {
      loading.value = false
    }
  }

  const restore = async () => {
    try {
      // nuxt-auth-utils handles session restoration automatically
      // We just need to refresh it if needed
      if (!user.value) {
        await refreshSession()
      }
    } catch {
      await clear()
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
