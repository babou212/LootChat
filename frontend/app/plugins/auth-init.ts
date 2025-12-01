import { useAuthStore } from '../../stores/auth'

/**
 * Initialize authentication on app startup
 *
 * This plugin:
 * 1. Syncs the session user to the auth store for compatibility
 * 2. Sets up periodic token refresh for short-lived JWT tokens (15 min expiry)
 *
 * Note: Session fetching is handled by the auth middleware to prevent flash to login.
 * The middleware fetches the session before making routing decisions.
 */
export default defineNuxtPlugin({
  name: 'auth-init',
  enforce: 'post', // Run after Pinia is initialized
  async setup(nuxtApp) {
    // Only run on client-side - Pinia stores need client context
    if (import.meta.server) {
      return
    }

    // Use nuxtApp.runWithContext to ensure proper composable context
    await nuxtApp.runWithContext(async () => {
      const { user } = useUserSession()
      const { refreshToken, isAuthenticated } = useAuth()
      const authStore = useAuthStore()

      // If we have a user, sync to auth store
      if (user.value) {
        authStore.setUser(user.value)
      }

      // Watch for user changes and sync to auth store
      watch(user, (newUser) => {
        if (newUser) {
          authStore.setUser(newUser)
        } else {
          authStore.clear()
        }
      })

      // Set up periodic token refresh for short-lived tokens
      // JWT tokens expire in 15 minutes, so refresh every 10 minutes
      // This ensures the token is always fresh when making API calls
      const REFRESH_INTERVAL = 10 * 60 * 1000 // 10 minutes
      let refreshInterval: ReturnType<typeof setInterval> | null = null

      const startTokenRefresh = () => {
        if (refreshInterval) return

        refreshInterval = setInterval(async () => {
          if (isAuthenticated.value) {
            try {
              await refreshToken()
            } catch {
              // Token refresh failed - user will be redirected to login on next API call
              console.warn('[Auth] Periodic token refresh failed')
            }
          }
        }, REFRESH_INTERVAL)
      }

      const stopTokenRefresh = () => {
        if (refreshInterval) {
          clearInterval(refreshInterval)
          refreshInterval = null
        }
      }

      // Start refresh if already authenticated
      if (isAuthenticated.value) {
        startTokenRefresh()
      }

      // Watch authentication state to start/stop refresh
      watch(isAuthenticated, (authenticated) => {
        if (authenticated) {
          startTokenRefresh()
        } else {
          stopTokenRefresh()
        }
      })
    })
  }
})
