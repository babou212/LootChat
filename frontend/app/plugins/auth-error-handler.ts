/**
 * Global error handler for authentication failures
 *
 * This plugin sets up a global error handler that:
 * 1. Intercepts 401 responses from API calls
 * 2. Attempts to refresh the token if possible
 * 3. Redirects to login if the session is truly expired
 *
 * This prevents users from seeing cryptic error messages when their
 * JWT token expires while they still have a valid session cookie.
 */
export default defineNuxtPlugin({
  name: 'auth-error-handler',
  enforce: 'post', // Run after Pinia is initialized
  setup(nuxtApp) {
    // Track if we're already handling a 401 to prevent loops
    let isHandling401 = false

    // Create a custom $fetch with auth error handling
    const authFetch = $fetch.create({
      credentials: 'include',
      async onResponseError({ response }) {
        // Handle 401 Unauthorized responses
        if (response.status === 401 && !isHandling401) {
          isHandling401 = true

          try {
            // Get auth composable inside the error handler using runWithContext
            await nuxtApp.runWithContext(async () => {
              const { refreshToken, logout } = useAuth()

              // Try to refresh the token
              const refreshed = await refreshToken()

              if (!refreshed) {
                // Token refresh failed - logout and redirect
                await logout()
                await navigateTo('/login')
              }
            })
          } catch {
            // If composable access fails, just redirect to login
            await nuxtApp.runWithContext(() => navigateTo('/login'))
          } finally {
            isHandling401 = false
          }
        }
      }
    })

    return {
      provide: {
        authFetch
      }
    }
  }
})
