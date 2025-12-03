import { isJwtExpired, refreshTokenIfNeeded } from '../utils/auth'

/**
 * Server middleware to validate and refresh JWT tokens
 *
 * Runs on every request and:
 * 1. Clears session if JWT is expired
 * 2. Refreshes JWT if it's about to expire
 *
 * This ensures API calls always have a valid token.
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

    // JWT expired - clear session immediately
    if (isJwtExpired(session.token as string)) {
      await clearUserSession(event)
      return
    }

    // Refresh token if expiring soon (within 2 minutes)
    await refreshTokenIfNeeded(event)
  } catch {
    // Silently handle - routes will handle auth failures
  }
})
