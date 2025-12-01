import { isJwtExpired, isJwtExpiredOrExpiring } from '../../utils/auth'

/**
 * Get current session information and validate JWT token
 * This endpoint checks both the session and JWT validity
 * Returns user info if valid, or attempts to refresh if token is expiring
 */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session || !session.user) {
    throw createError({
      statusCode: 401,
      message: 'Not authenticated'
    })
  }

  // Validate that JWT token exists
  const token = session.token as string | undefined
  if (!token) {
    // Session exists but token is missing - clear session
    await clearUserSession(event)
    throw createError({
      statusCode: 401,
      message: 'Invalid session - token missing'
    })
  }

  // Check if JWT token is completely expired
  if (isJwtExpired(token)) {
    await clearUserSession(event)
    throw createError({
      statusCode: 401,
      message: 'Session expired - please login again'
    })
  }

  // Check if token is about to expire and needs refresh
  // Return a flag so the client can trigger a refresh
  const needsRefresh = isJwtExpiredOrExpiring(token)

  return {
    user: session.user,
    needsRefresh
  }
})
