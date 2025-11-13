import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event): Promise<unknown> => {
  const session = await getUserSession(event)

  if (!session || !session.token) {
    throw createError({
      statusCode: 401,
      message: 'Not authenticated'
    })
  }

  const config = useRuntimeConfig()

  try {
    const channels: unknown = await $fetch<unknown>(`${config.public.apiUrl}/api/channels`, {
      headers: {
        Authorization: `Bearer ${session.token}`
      }
    })
    return channels
  } catch {
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch channels'
    })
  }
})
