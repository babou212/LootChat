import { useAuthStore } from '../../stores/auth'

/**
 * Initialize authentication state on app startup
 *
 * Syncs session user to Pinia store and sets up periodic token refresh.
 * Session fetching is handled by the auth middleware.
 */
export default defineNuxtPlugin({
  name: 'auth-init',
  enforce: 'post',
  async setup(nuxtApp) {
    // Only run on client
    if (import.meta.server) return

    await nuxtApp.runWithContext(async () => {
      const { user, loggedIn } = useUserSession()
      const { refreshToken } = useAuth()
      const authStore = useAuthStore()

      // Sync user to auth store
      if (user.value) {
        authStore.setUser(user.value)
      }

      watch(user, (newUser) => {
        if (newUser) {
          authStore.setUser(newUser)
        } else {
          authStore.clear()
        }
      })

      // Token refresh interval (every 10 minutes)
      const REFRESH_INTERVAL = 10 * 60 * 1000
      let refreshTimer: ReturnType<typeof setInterval> | null = null

      const startRefresh = () => {
        if (refreshTimer) return
        refreshTimer = setInterval(() => {
          if (loggedIn.value) {
            refreshToken().catch(() => {})
          }
        }, REFRESH_INTERVAL)
      }

      const stopRefresh = () => {
        if (refreshTimer) {
          clearInterval(refreshTimer)
          refreshTimer = null
        }
      }

      // Start/stop refresh based on auth state
      if (loggedIn.value) startRefresh()

      watch(loggedIn, (authenticated) => {
        if (authenticated) {
          startRefresh()
        } else {
          stopRefresh()
        }
      })
    })
  }
})
