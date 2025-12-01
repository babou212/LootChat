import { refreshTokenIfNeeded, isJwtExpired } from '../utils/auth'

/**
 * Server middleware to automatically refresh JWT tokens before they expire
 *
 * This middleware runs on every server request and:
 * 1. Checks if the user has a session with a token
 * 2. If the token is about to expire, attempts to refresh it
 * 3. If the token is fully expired and can't be refreshed, clears the session
 *
 * This ensures that API calls always have a valid token and prevents
 * the session/JWT mismatch issue where a session exists but the JWT is expired.
 */
export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname

  // Skip auth refresh for public paths
  const publicPaths = [
    '/api/auth/login',
    '/api/auth/logout',
    '/api/auth/password',
    '/_nuxt',
    '/__nuxt',
    '/favicon.ico'
  ]

  const isPublicPath = publicPaths.some(p => path.startsWith(p))
  if (isPublicPath) {
    return
  }

  // Skip for non-API routes that don't need auth checking
  // But check for page navigation to validate session
  const isApiRoute = path.startsWith('/api/')
  const isPageNavigation = !isApiRoute && !path.includes('.')

  if (!isApiRoute && !isPageNavigation) {
    return
  }

  try {
    // Use the session data directly without the auto-import
    const session = await getUserSession(event) as { token?: string } | undefined

    // No session, nothing to do
    if (!session || !session.token) {
      return
    }

    // If token is completely expired, clear session immediately
    if (isJwtExpired(session.token)) {
      await clearUserSession(event)
      return
    }

    // Check if token is about to expire and refresh proactively
    // This will update the session with a new token if successful
    await refreshTokenIfNeeded(event)
  } catch {
    // Silently handle errors - the actual API routes will handle auth failures
  }
})
