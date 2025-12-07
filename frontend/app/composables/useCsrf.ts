export const useCsrf = () => {
  const config = useRuntimeConfig()
  const csrfToken = useState<string | null>('csrf-token', () => null)

  const fetchCsrfToken = async (): Promise<void> => {
    try {
      const response = await $fetch<{ token: string }>(`${config.public.apiUrl}/api/csrf/token`, {
        credentials: 'include'
      })
      csrfToken.value = response.token
    } catch (error) {
      console.error('Failed to fetch CSRF token:', error)
      csrfToken.value = null
    }
  }

  const getCsrfToken = (): string | null => {
    return csrfToken.value
  }

  const getCsrfTokenFromCookie = (): string | null => {
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

  return {
    csrfToken: readonly(csrfToken),
    fetchCsrfToken,
    getCsrfToken,
    getCsrfTokenFromCookie
  }
}
