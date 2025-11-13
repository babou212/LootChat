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

  return $fetch.create({
    baseURL: config.public.apiUrl,
    headers: {
      Authorization: `Bearer ${session.token}`
    }
  })
}
