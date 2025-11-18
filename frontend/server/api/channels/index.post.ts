import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event): Promise<unknown> => {
  // Validate request body
  const body = await validateBody(event, createChannelSchema)

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
    const channel: unknown = await $fetch<unknown>(`${apiUrl}/api/channels`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.token}`
      },
      body
    })
    return channel
  } catch {
    throw createError({
      statusCode: 500,
      message: 'Failed to create channel'
    })
  }
})
