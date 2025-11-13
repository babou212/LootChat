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
      const response = await $fetch<{ success: boolean, user: User }>('/api/auth/login', {
        method: 'POST',
        body: credentials,
        credentials: 'include'
      })

      if (response.success && response.user) {
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
      await $fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      })

      authStore.clear()
      error.value = null
    } catch (err) {
      console.error('Logout error:', err)
      authStore.clear()
    } finally {
      loading.value = false
    }
  }

  const restore = async () => {
    try {
      if (user.value) return

      const response = await $fetch<{ user: User }>('/api/auth/session', {
        credentials: 'include'
      })

      if (response.user) {
        authStore.setUser(response.user)
      }
    } catch {
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
