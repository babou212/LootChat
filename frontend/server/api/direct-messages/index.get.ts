export default defineEventHandler(async (event): Promise<unknown> => {
  try {
    const authFetch = await createAuthenticatedFetch(event)
    return await authFetch('/api/direct-messages') as unknown
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 401) {
      throw error
    }
    console.error('Failed to fetch direct messages:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch direct messages'
    })
  }
})
