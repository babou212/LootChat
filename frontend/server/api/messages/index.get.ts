export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const channelIdRaw = query.channelId
  const pageRaw = query.page
  const sizeRaw = query.size
  let channelIdParam: string | undefined
  let pageParam: string | undefined
  let sizeParam: string | undefined

  if (typeof channelIdRaw === 'string' && channelIdRaw.trim() !== '') {
    if (/^\d+$/.test(channelIdRaw)) {
      channelIdParam = channelIdRaw
    } else {
      console.warn('[messages:index.get] Ignoring invalid channelId query param:', channelIdRaw)
    }
  }

  if (typeof pageRaw === 'string' && pageRaw.trim() !== '') {
    if (/^\d+$/.test(pageRaw)) {
      pageParam = pageRaw
    }
  }

  if (typeof sizeRaw === 'string' && sizeRaw.trim() !== '') {
    if (/^\d+$/.test(sizeRaw)) {
      sizeParam = sizeRaw
    }
  }

  try {
    const authFetch = await createAuthenticatedFetch(event)

    const params = new URLSearchParams()
    if (channelIdParam) {
      params.set('channelId', channelIdParam)
    }
    if (pageParam) {
      params.set('page', pageParam)
    }
    if (sizeParam) {
      params.set('size', sizeParam)
    }

    const queryString = params.toString()
    const url = queryString ? `/api/messages?${queryString}` : '/api/messages'

    return await authFetch(url)
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 401) {
      throw error
    }
    console.error('Failed to fetch messages:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch messages'
    })
  }
})
