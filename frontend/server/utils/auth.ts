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
 * Refresh JWT token if expiring soon or expired (within grace period)
 * Returns current or new token, null if refresh failed after retries
 *
 * Grace period allows refresh of expired tokens to keep session alive for 7 days
 * Retries up to 3 times with exponential backoff for network resilience
 */
export async function refreshTokenIfNeeded(event: H3Event): Promise<string | null> {
  const session = await getUserSession(event)
  const token = session?.token

  if (!session?.user || !token || typeof token !== 'string') return null

  // Token not expiring soon - return current
  if (!isJwtExpiring(token, 300)) return token // Increased buffer to 5 minutes

  // Token expired but within session grace period - attempt refresh
  // Session lasts 7 days, so we allow refresh of expired tokens
  const payload = decodeJwtPayload(token)
  if (payload?.exp) {
    const expiredSeconds = Math.floor(Date.now() / 1000) - payload.exp
    // If expired more than 7 days, don't try to refresh
    if (expiredSeconds > 60 * 60 * 24 * 7) {
      await clearUserSession(event)
      return null
    }
  }

  // Attempt token refresh with retries
  const config = useRuntimeConfig()
  const apiUrl = config.apiUrl || config.public.apiUrl
  const maxRetries = 3
  const baseDelay = 100 // ms

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await $fetch<{
        token: string
        userId: string | number
        username: string
        email: string
        role: string
        avatar?: string
      }>(`${apiUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        retry: 0 // Handle retries ourselves
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      // Only clear session on explicit 401/403 errors, not network errors
      const is401or403 = error?.response?.status === 401 || error?.response?.status === 403

      // If this was the last attempt and it's an auth error, clear session
      if (attempt === maxRetries - 1 && is401or403) {
        await clearUserSession(event)
        return null
      }

      // If it's a network error and not the last attempt, retry
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }

      // Network error on last attempt - keep session, return old token
      // User can still use the app, token will refresh on next successful request
      return token
    }
  }

  // Should not reach here, but return token to be safe
  return token
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
