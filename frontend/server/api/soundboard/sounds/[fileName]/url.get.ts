import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event): Promise<unknown> => {
  try {
    const query = getQuery(event)
    const filePath = query.path as string
    
    if (!filePath) {
      throw createError({
        statusCode: 400,
        message: 'File path is required'
      })
    }

    const authFetch = await createValidatedFetch(event)
    
    return await authFetch(`/api/soundboard/sounds/${filePath}/url`)
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 401) {
      throw error
    }
    throw createError({
      statusCode: 500,
      message: 'Failed to get audio URL'
    })
  }
})
