export default defineEventHandler(async (event): Promise<unknown> => {
  const config = useRuntimeConfig()
  const query = getQuery(event)

  const session = await getUserSession(event)

  if (!session || !session.token) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const params = new URLSearchParams()
  if (query.query) params.append('query', String(query.query))
  if (query.channelId) params.append('channelId', String(query.channelId))
  if (query.page) params.append('page', String(query.page))
  if (query.size) params.append('size', String(query.size))

  try {
    const response: unknown = await $fetch(`${config.apiUrl}/api/search/messages?${params.toString()}`, {
      method: 'GET',
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
      statusMessage: err.message || 'Search failed'
    })
  }
})
