import type { LoginRequest, User } from '../../shared/types/user'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '../../stores/auth'

export const useAuth = () => {
  const authStore = useAuthStore()
  const { user } = storeToRefs(authStore)
  const loading = useState<boolean>('auth-loading', () => false)
  const error = useState<string | null>('auth-error', () => null)

  const login = async (credentials: LoginRequest) => {
    loading.value = true
    error.value = null

    try {
      // Call server API route which handles httpOnly cookies
      const response = await $fetch<{ success: boolean, user: User }>('/api/auth/login', {
        method: 'POST',
        body: credentials,
        // CSRF protection is handled automatically by Nuxt
        credentials: 'include'
      })

      if (response.success && response.user) {
        // Update store with user data (token is in httpOnly cookie)
        authStore.setUser(response.user)

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
      // Call server API to clear session
      await $fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      })

      authStore.clear()
      error.value = null
    } catch (err) {
      console.error('Logout error:', err)
      // Clear local state even if server call fails
      authStore.clear()
    } finally {
      loading.value = false
    }
  }

  const restore = async () => {
    try {
      if (user.value) return

      // Fetch session from server
      const response = await $fetch<{ user: User }>('/api/auth/session', {
        credentials: 'include'
      })

      if (response.user) {
        authStore.setUser(response.user)
      }
    } catch {
      // Session doesn't exist or is invalid
      authStore.clear()
    }
  }

  const isAuthenticated = computed(() => !!user.value)

  return {
    user: readonly(user),
    loading: readonly(loading),
    error: readonly(error),
    isAuthenticated,
    login,
    logout,
    restore
  }
}
