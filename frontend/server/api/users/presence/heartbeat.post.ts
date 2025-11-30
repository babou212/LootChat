import type { H3Event } from 'h3'

/**
 * Presence heartbeat endpoint.
 * Proxies to backend to refresh the user's presence TTL.
 */
export default defineEventHandler(async (event: H3Event): Promise<{ success: boolean }> => {
  const session = await getUserSession(event)

  if (!session || !session.token) {
    throw createError({
      statusCode: 401,
      message: 'Not authenticated'
    })
  }

  try {
    const config = useRuntimeConfig()
    const apiUrl = config.apiUrl || config.public.apiUrl

    await $fetch(`${apiUrl}/api/users/presence/heartbeat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.token}`
      }
    })

    return { success: true }
  } catch (error: unknown) {
    console.error('Failed to send presence heartbeat:', error)
    // Don't throw - heartbeat failures shouldn't break the UI
    return { success: false }
  }
})
