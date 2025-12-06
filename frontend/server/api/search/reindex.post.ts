export default defineEventHandler(async (event): Promise<unknown> => {
  const config = useRuntimeConfig()

  const session = await getUserSession(event)

  if (!session || !session.token) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  try {
    const response: unknown = await $fetch(`${config.apiUrl}/api/search/reindex`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      }
    })

    return response
  } catch (error: unknown) {
    const err = error as { statusCode?: number, message?: string }
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.message || 'Reindex failed'
    })
  }
})
