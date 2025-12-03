import type { H3Event } from 'h3'

function decodeJwtPayload(token: string): { exp?: number } | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3 || !parts[1]) return null

    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'))
  } catch {
    return null
  }
}

/**
 * Check if JWT is expired
 */
export function isJwtExpired(token: string): boolean {
  const payload = decodeJwtPayload(token)
  if (!payload?.exp) return true
  return payload.exp <= Math.floor(Date.now() / 1000)
}

/**
 * Check if JWT expires within buffer seconds (default 2 minutes)
 */
export function isJwtExpiring(token: string, bufferSeconds = 120): boolean {
  const payload = decodeJwtPayload(token)
  if (!payload?.exp) return true
  return payload.exp <= Math.floor(Date.now() / 1000) + bufferSeconds
}

/**
 * Get JWT token from session
 * Throws 401 if missing or expired
 */
export async function requireSessionToken(event: H3Event): Promise<string> {
  const session = await getUserSession(event)
  const token = session?.token

  if (!token || typeof token !== 'string') {
    throw createError({ statusCode: 401, message: 'Authentication required' })
  }

  if (isJwtExpired(token)) {
    await clearUserSession(event)
    throw createError({ statusCode: 401, message: 'Session expired' })
  }

  return token
}

/**
 * Refresh JWT token if expiring soon
 * Returns current or new token, null if refresh failed
 */
export async function refreshTokenIfNeeded(event: H3Event): Promise<string | null> {
  const session = await getUserSession(event)
  const token = session?.token

  if (!session?.user || !token || typeof token !== 'string') return null

  // Token not expiring soon - return current
  if (!isJwtExpiring(token)) return token

  // Token already expired - can't refresh
  if (isJwtExpired(token)) {
    await clearUserSession(event)
    return null
  }

  // Attempt token refresh
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
      headers: { Authorization: `Bearer ${token}` }
    })

    if (!response.token) {
      await clearUserSession(event)
      return null
    }

    await replaceUserSession(event, {
      user: {
        userId: typeof response.userId === 'string' ? parseInt(response.userId) : response.userId,
        username: response.username,
        email: response.email,
        role: response.role,
        avatar: response.avatar
      },
      token: response.token,
      loggedInAt: session.loggedInAt
    })

    return response.token
  } catch {
    await clearUserSession(event)
    return null
  }
}

/**
 * Get valid token, refreshing if needed
 * Throws 401 on failure
 */
export async function requireValidToken(event: H3Event): Promise<string> {
  const token = await refreshTokenIfNeeded(event)

  if (!token) {
    throw createError({ statusCode: 401, message: 'Session expired' })
  }

  return token
}

/**
 * Create authenticated fetch for backend API calls
 */
export async function createValidatedFetch(event: H3Event) {
  const token = await requireValidToken(event)
  const config = useRuntimeConfig()

  return $fetch.create({
    baseURL: config.apiUrl || config.public.apiUrl,
    headers: { Authorization: `Bearer ${token}` }
  })
}
