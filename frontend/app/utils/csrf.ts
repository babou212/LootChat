/**
 * Get CSRF token from cookie
 */
export const getCsrfTokenFromCookie = (): string | null => {
  if (import.meta.server) return null

  const cookies = document.cookie.split(';')
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=')
    if (name === 'XSRF-TOKEN' && value) {
      return decodeURIComponent(value)
    }
  }
  return null
}

/**
 * Add CSRF token to request headers
 */
export const addCsrfHeader = (headers: HeadersInit = {}): HeadersInit => {
  if (import.meta.server) return headers

  const token = getCsrfTokenFromCookie()
  if (token) {
    return {
      ...headers,
      'X-XSRF-TOKEN': token
    }
  }
  return headers
}

/**
 * Fetch wrapper that automatically adds CSRF token
 */
export const apiFetch = async <T = unknown>(
  url: string,
  options: Parameters<typeof $fetch>[1] = {}
): Promise<T> => {
  const headers = addCsrfHeader(options.headers as HeadersInit)

  return await $fetch<T>(url, {
    ...options,
    headers,
    credentials: 'include'
  }) as T
}
