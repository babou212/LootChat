import type { H3Event } from 'h3'

/**
 * Server-side utility to get authenticated fetch instance
 * Use this for making authenticated API calls from server endpoints
 */
export const useAuthenticatedFetch = async (event: H3Event) => {
  const session = await getUserSession(event)

  if (!session || !session.token) {
    throw createError({
      statusCode: 401,
      message: 'Not authenticated'
    })
  }

  const config = useRuntimeConfig()
  const apiUrl = config.apiUrl || config.public.apiUrl

  return $fetch.create({
    baseURL: apiUrl,
    headers: {
      Authorization: `Bearer ${session.token}`
    }
  })
}
