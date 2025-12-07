import type { H3Event } from 'h3'

/**
 * Get CSRF token from request cookies
 */
export const getCsrfToken = (event: H3Event): string | null => {
  const cookies = parseCookies(event)
  return cookies['XSRF-TOKEN'] || null
}

/**
 * Add CSRF token to request headers if available
 */
export const addCsrfToHeaders = (event: H3Event, headers: Record<string, string> = {}): Record<string, string> => {
  const token = getCsrfToken(event)
  if (token) {
    return {
      ...headers,
      'X-XSRF-TOKEN': token
    }
  }
  return headers
}
