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

export function isJwtExpired(token: string): boolean {
  const payload = decodeJwtPayload(token)
  if (!payload?.exp) return true
  return payload.exp <= Math.floor(Date.now() / 1000)
}

export function isJwtExpiring(token: string, bufferSeconds = 120): boolean {
  const payload = decodeJwtPayload(token)
  if (!payload?.exp) return true
  return payload.exp <= Math.floor(Date.now() / 1000) + bufferSeconds
}

export async function requireSessionToken(event: H3Event): Promise<string> {
  const session = await getUserSession(event)
  const token = session?.token

  if (!token || typeof token !== 'string') {
    throw createError({ statusCode: 401, message: 'Authentication required' })
  }

  return token
}

export async function refreshTokenIfNeeded(event: H3Event): Promise<string | null> {
  const session = await getUserSession(event)
  const token = session?.token

  if (!session?.user || !token || typeof token !== 'string') return null

  if (!isJwtExpiring(token, 300)) return token

  const config = useRuntimeConfig()
  const apiUrl = config.apiUrl || config.public.apiUrl

  const failedAttempts = (session.failedRefreshAttempts as number) || 0
  const maxFailures = 3

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
      retry: 1
    })

    if (!response.token) {
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
      loggedInAt: session.loggedInAt,
      failedRefreshAttempts: 0
    })

    return response.token
  } catch (error: unknown) {
    const fetchError = error as { response?: { status?: number } }
    const isAuthError = fetchError?.response?.status === 401 || fetchError?.response?.status === 403

    if (isAuthError) {
      const newFailedAttempts = failedAttempts + 1

      if (newFailedAttempts >= maxFailures) {
        await clearUserSession(event)
        return null
      }

      await replaceUserSession(event, {
        ...session,
        failedRefreshAttempts: newFailedAttempts
      })
    }

    return token
  }
}

export async function requireValidToken(event: H3Event): Promise<string> {
  const token = await refreshTokenIfNeeded(event)

  if (!token) {
    throw createError({ statusCode: 401, message: 'Session expired' })
  }

  return token
}

export async function createValidatedFetch(event: H3Event) {
  const token = await requireValidToken(event)
  const config = useRuntimeConfig()

  // Get CSRF token from cookies if available
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`
  }

  const csrfToken = getCsrfToken(event)
  if (csrfToken) {
    headers['X-XSRF-TOKEN'] = csrfToken
  }

  // Forward cookies to backend
  const cookieHeader = getHeader(event, 'cookie')
  if (cookieHeader) {
    headers['Cookie'] = cookieHeader
  }

  return $fetch.create({
    baseURL: config.apiUrl || config.public.apiUrl,
    headers
  })
}
