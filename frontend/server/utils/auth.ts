import type { H3Event } from 'h3'

/**
 * Get the JWT token from the user session
 * This token is used for authenticating with the backend API
 */
export async function getSessionToken(event: H3Event): Promise<string | null> {
  const session = await getUserSession(event)
  return session?.token || null
}

/**
 * Require authentication and return the JWT token
 * Throws a 401 error if not authenticated
 */
export async function requireSessionToken(event: H3Event): Promise<string> {
  const token = await getSessionToken(event)

  if (!token) {
    throw createError({
      statusCode: 401,
      message: 'Authentication required'
    })
  }

  return token
}

/**
 * Create an authenticated fetch instance for backend API calls
 * Automatically includes the JWT token from the session
 */
export async function createAuthenticatedFetch(event: H3Event) {
  const token = await requireSessionToken(event)
  const config = useRuntimeConfig()
  const apiUrl = config.apiUrl || config.public.apiUrl

  return $fetch.create({
    baseURL: apiUrl,
    headers: {
      Authorization: `Bearer ${token}`
    }
  })
}

/**
 * Check if the current session is valid and not expired
 */
export async function isSessionValid(event: H3Event): Promise<boolean> {
  const session = await getUserSession(event)

  if (!session || !session.user || !session.token) {
    return false
  }

  // Check if session has expired
  if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
    await clearUserSession(event)
    return false
  }

  return true
}
