import type { H3Event } from 'h3'

/**
 * Decode a JWT token to extract its payload (without verification)
 * This is safe because we only use it to check expiration client-side
 * The backend still validates the signature
 */
function decodeJwtPayload(token: string): { exp?: number, iat?: number, sub?: string } | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payloadPart = parts[1]
    if (!payloadPart) return null
    // Convert base64url to regular base64
    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'))
    return payload
  } catch {
    return null
  }
}

/**
 * Check if a JWT token is expired or about to expire
 * @param token - The JWT token to check
 * @param bufferSeconds - Number of seconds before expiration to consider "about to expire" (default: 2 minutes)
 */
export function isJwtExpiredOrExpiring(token: string, bufferSeconds: number = 120): boolean {
  const payload = decodeJwtPayload(token)
  if (!payload || !payload.exp) return true

  const nowSeconds = Math.floor(Date.now() / 1000)
  const expiresAt = payload.exp

  return expiresAt <= (nowSeconds + bufferSeconds)
}

/**
 * Check if a JWT token is completely expired (no buffer)
 */
export function isJwtExpired(token: string): boolean {
  return isJwtExpiredOrExpiring(token, 0)
}

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
 * @deprecated Use createValidatedFetch instead for automatic token refresh
 */
export async function createAuthenticatedFetch(event: H3Event) {
  // Use the validated fetch which handles token refresh
  return createValidatedFetch(event)
}

/**
 * Check if the current session is valid and not expired
 * Also checks if the JWT token is expired
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

  // Check if JWT token is expired
  if (isJwtExpired(session.token)) {
    await clearUserSession(event)
    return false
  }

  return true
}

/**
 * Attempt to refresh the JWT token if it's about to expire
 * Returns the current or new token, or null if refresh failed
 */
export async function refreshTokenIfNeeded(event: H3Event): Promise<string | null> {
  const session = await getUserSession(event)

  if (!session || !session.user || !session.token) {
    return null
  }

  // If token is not expiring soon, return current token
  if (!isJwtExpiredOrExpiring(session.token)) {
    return session.token
  }

  // If token is already completely expired, we can't refresh
  if (isJwtExpired(session.token)) {
    await clearUserSession(event)
    return null
  }

  // Try to refresh the token
  try {
    const config = useRuntimeConfig()
    const apiUrl = config.apiUrl || config.public.apiUrl

    const response = await $fetch<{
      token: string
      userId: string | number
      username: string
      email: string
      role: string
      avatar?: string
    }>(`${apiUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.token}`
      }
    })

    if (!response.token) {
      await clearUserSession(event)
      return null
    }

    // Calculate new expiration (7 days from now)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    // Update the session with new token
    await replaceUserSession(event, {
      user: {
        userId: typeof response.userId === 'string' ? parseInt(response.userId) : response.userId,
        username: response.username,
        email: response.email,
        role: response.role,
        avatar: response.avatar
      },
      token: response.token,
      loggedInAt: session.loggedInAt,
      expiresAt
    })

    return response.token
  } catch {
    // Token refresh failed - clear session
    await clearUserSession(event)
    return null
  }
}

/**
 * Get a valid token, refreshing if necessary
 * Throws 401 if no valid token can be obtained
 */
export async function requireValidToken(event: H3Event): Promise<string> {
  const token = await refreshTokenIfNeeded(event)

  if (!token) {
    throw createError({
      statusCode: 401,
      message: 'Session expired'
    })
  }

  return token
}

/**
 * Create an authenticated fetch instance that ensures token is valid
 * Will refresh the token if it's about to expire
 */
export async function createValidatedFetch(event: H3Event) {
  const token = await requireValidToken(event)
  const config = useRuntimeConfig()
  const apiUrl = config.apiUrl || config.public.apiUrl

  return $fetch.create({
    baseURL: apiUrl,
    headers: {
      Authorization: `Bearer ${token}`
    }
  })
}
