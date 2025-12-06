import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event): Promise<unknown> => {
  try {
    const soundId = getRouterParam(event, 'soundId')
    const authFetch = await createValidatedFetch(event)

    return await authFetch(`/api/soundboard/sounds/${soundId}`, {
      method: 'DELETE'
    })
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 401) {
      throw error
    }
    throw createError({
      statusCode: 500,
      message: 'Failed to delete sound'
    })
  }
})
