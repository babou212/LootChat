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
  const messageId = getRouterParam(event, 'id')
  const body = await readBody(event)

  try {
    const reaction: unknown = await $fetch<unknown>(`${config.apiUrl || config.public.apiUrl}/api/messages/${messageId}/reactions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.token}`
      },
      body
    })
    return reaction
  } catch (error: unknown) {
    console.error('Failed to add reaction:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to add reaction'
    })
  }
})
