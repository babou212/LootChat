import { refreshTokenIfNeeded } from '../utils/auth'

/**
 * Server middleware to validate and refresh JWT tokens
 *
 * Runs on every request and:
 * 1. Attempts to refresh expired or expiring JWT tokens
 * 2. Clears session only if refresh fails or token expired beyond grace period
 *
 * This keeps the session alive for 7 days even though JWT expires after 15 minutes.
 */
export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname

  // Skip for static assets and auth endpoints
  if (
    path.startsWith('/_nuxt')
    || path.startsWith('/__nuxt')
    || path.startsWith('/api/auth/login')
    || path.startsWith('/api/auth/logout')
    || path.includes('.') // Static files
  ) {
    return
  }

  try {
    const session = await getUserSession(event)

    // No session - nothing to validate
    if (!session?.token) {
      return
    }

    // Attempt to refresh token (handles expired tokens within grace period)
    await refreshTokenIfNeeded(event)
  } catch {
    // Silently handle - routes will handle auth failures
  }
})
