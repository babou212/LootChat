/**
 * Client-side composable for making authenticated API calls
 * Automatically handles JWT token management via server-side session
 *
 * This composable makes API calls through Nuxt server routes which
 * automatically include the JWT token from the secure session.
 * The JWT token never exposed to the client.
 */

/**
 * Create an authenticated fetch instance for API calls
 * All requests go through the Nuxt server which handles token management
 *
 * @example
 * const { data, error } = await useAuthenticatedFetch('/api/channels')
 *
 * @example
 * const { data } = await useAuthenticatedFetch('/api/messages', {
 *   method: 'POST',
 *   body: { content: 'Hello' }
 * })
 */
export const useAuthenticatedFetch = <T = unknown>(
  url: string,
  options?: Parameters<typeof $fetch>[1]
) => {
  return $fetch<T>(url, {
    ...options,
    credentials: 'include' // Ensure cookies are sent with requests
  })
}

/**
 * Composable for making authenticated API calls with automatic error handling
 * Returns reactive data, error, and loading states
 *
 * @example
 * const { data, error, loading, refresh } = useAuthenticatedData('/api/channels')
 */
export const useAuthenticatedData = <T = unknown>(url: string) => {
  const data = ref<T | null>(null)
  const error = ref<Error | null>(null)
  const loading = ref(false)

  const fetch = async () => {
    loading.value = true
    error.value = null

    try {
      data.value = await useAuthenticatedFetch<T>(url)
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err))
    } finally {
      loading.value = false
    }
  }

  // Auto-fetch on mount
  onMounted(() => {
    fetch()
  })

  return {
    data: readonly(data),
    error: readonly(error),
    loading: readonly(loading),
    refresh: fetch
  }
}
