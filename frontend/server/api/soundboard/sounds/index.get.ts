import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event): Promise<unknown> => {
  try {
    const authFetch = await createValidatedFetch(event)
    return await authFetch('/api/soundboard/sounds')
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 401) {
      throw error
    }
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch soundboard sounds'
    })
  }
})
