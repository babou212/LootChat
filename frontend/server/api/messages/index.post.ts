import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event): Promise<unknown> => {
  const body = await validateBody(event, createMessageSchema)

  try {
    const authFetch = await createAuthenticatedFetch(event)
    return await authFetch('/api/messages', {
      method: 'POST',
      body
    })
  } catch {
    throw createError({
      statusCode: 500,
      message: 'Failed to create message'
    })
  }
})
