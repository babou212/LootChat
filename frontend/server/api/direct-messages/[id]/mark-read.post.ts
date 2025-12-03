import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event): Promise<unknown> => {
  const id = getRouterParam(event, 'id')

  try {
    const authFetch = await createValidatedFetch(event)
    return await authFetch(`/api/direct-messages/${id}/mark-read`, {
      method: 'POST'
    })
  } catch {
    throw createError({
      statusCode: 500,
      message: 'Failed to mark messages as read'
    })
  }
})
