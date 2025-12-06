import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event): Promise<unknown> => {
  try {
    const channelId = getRouterParam(event, 'channelId')
    const soundId = getRouterParam(event, 'soundId')
    const authFetch = await createValidatedFetch(event)

    return await authFetch(`/api/soundboard/channels/${channelId}/sounds/${soundId}/play`, {
      method: 'POST'
    })
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 401) {
      throw error
    }
    throw createError({
      statusCode: 500,
      message: 'Failed to play sound'
    })
  }
})
