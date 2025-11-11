import type { AuthResponse, LoginRequest, User } from '../../shared/types/user'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '../../stores/auth'

export const useAuth = () => {
  const authStore = useAuthStore()
  const { user } = storeToRefs(authStore)
  const loading = useState<boolean>('auth-loading', () => false)
  const error = useState<string | null>('auth-error', () => null)

  const authTokenCookie = useCookie('auth_token', {
    maxAge: 60 * 60 * 24 * 7,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  })

  const authUserCookie = useCookie<User | null>('auth_user', {
    maxAge: 60 * 60 * 24 * 7,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  })

  const apiBase = useRuntimeConfig().public.apiBase || 'http://localhost:8080/api/auth'

  const token = computed<string | null>(() => authTokenCookie.value || null)

  const login = async (credentials: LoginRequest) => {
    loading.value = true
    error.value = null

    try {
      const response = await $fetch<AuthResponse>(`${apiBase}/login`, {
        method: 'POST',
        body: credentials
      })

      console.log('Auth response:', response)

      if (response.token) {
        authTokenCookie.value = response.token

        const nextUser: User = {
          userId: typeof response.userId === 'string' ? parseInt(response.userId) : response.userId,
          username: response.username!,
          email: response.email!,
          role: response.role!,
          avatar: response.avatar
        }

        console.log('Storing user:', nextUser)

        authStore.setAuth(nextUser, response.token)
        authUserCookie.value = nextUser

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

  const logout = () => {
    authStore.clear()
    error.value = null
    authTokenCookie.value = null
    authUserCookie.value = null
  }

  const restore = async () => {
    try {
      if (user.value) return
      if (!authTokenCookie.value) return
      if (authUserCookie.value) {
        authStore.setAuth(authUserCookie.value as User, authTokenCookie.value)
        return
      }
    } catch {
      authUserCookie.value = null
    }
  }

  const isAuthenticated = computed(() => !!user.value && !!authTokenCookie.value)

  return {
    user: readonly(user),
    token: readonly(token),
    loading: readonly(loading),
    error: readonly(error),
    isAuthenticated,
    login,
    logout,
    restore
  }
}
