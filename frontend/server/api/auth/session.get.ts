import { isJwtExpired, isJwtExpiring } from '../../utils/auth'

/**
 * Get current session and validate JWT
 * Returns user info if valid, clears session if JWT expired
 */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  const token = session.token as string | undefined
  if (!token) {
    await clearUserSession(event)
    throw createError({ statusCode: 401, message: 'Invalid session' })
  }

  if (isJwtExpired(token)) {
    await clearUserSession(event)
    throw createError({ statusCode: 401, message: 'Session expired' })
  }

  return {
    user: session.user,
    needsRefresh: isJwtExpiring(token)
  }
})
