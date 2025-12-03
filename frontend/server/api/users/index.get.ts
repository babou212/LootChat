import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event): Promise<unknown> => {
  try {
    const authFetch = await createValidatedFetch(event)
    return await authFetch('/api/users')
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 401) {
      throw error
    }
    console.error('Failed to fetch users:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch users'
    })
  }
})
