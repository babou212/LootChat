import type { AuthResponse, LoginRequest, User } from '../../shared/types/user'

export const useAuth = () => {
  const user = useState<User | null>('user', () => null)
  const token = useState<string | null>('token', () => null)
  const loading = useState<boolean>('auth-loading', () => false)
  const error = useState<string | null>('auth-error', () => null)

  const apiBase = useRuntimeConfig().public.apiBase || 'http://localhost:8080/api/auth'

  const login = async (credentials: LoginRequest) => {
    loading.value = true
    error.value = null

    try {
      const response = await $fetch<AuthResponse>(`${apiBase}/login`, {
        method: 'POST',
        body: credentials
      })

      if (response.token) {
        token.value = response.token
        user.value = {
          id: 0, // Will be fetched from /user endpoint
          username: response.username!,
          email: response.email!,
          role: response.role!
        }

        // Store token in localStorage
        if (import.meta.client) {
          localStorage.setItem('auth_token', response.token)
        }

        // Fetch full user details
        await fetchCurrentUser()

        return { success: true, message: response.message }
      } else {
        error.value = response.message
        return { success: false, message: response.message }
      }
    } catch (err: unknown) {
      const errorMessage = err && typeof err === 'object' && 'data' in err
        ? ((err as { data?: { message?: string } }).data?.message || 'Login failed')
        : 'Login failed'
      error.value = errorMessage
      return { success: false, message: error.value }
    } finally {
      loading.value = false
    }
  }

  const fetchCurrentUser = async () => {
    if (!token.value) {
      if (import.meta.client) {
        token.value = localStorage.getItem('auth_token')
      }
    }

    if (!token.value) {
      return
    }

    try {
      const response = await $fetch<User>(`${apiBase}/user`, {
        headers: {
          Authorization: `Bearer ${token.value}`
        }
      })

      user.value = response
    } catch {
      logout()
    }
  }

  const logout = () => {
    user.value = null
    token.value = null
    error.value = null

    if (import.meta.client) {
      localStorage.removeItem('auth_token')
    }
  }

  const isAuthenticated = computed(() => !!user.value && !!token.value)

  return {
    user: readonly(user),
    token: readonly(token),
    loading: readonly(loading),
    error: readonly(error),
    isAuthenticated,
    login,
    logout,
    fetchCurrentUser
  }
}
