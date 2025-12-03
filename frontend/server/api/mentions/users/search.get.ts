import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event): Promise<unknown> => {
  const query = getQuery(event)
  const prefix = query.prefix as string || ''

  try {
    const authFetch = await createValidatedFetch(event)
    return await authFetch('/api/mentions/users/search', {
      params: { prefix }
    })
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 401) {
      throw error
    }
    console.error('Failed to search mentions:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to search mentions'
    })
  }
})
