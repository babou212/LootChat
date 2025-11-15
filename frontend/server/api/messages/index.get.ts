export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session || !session.token) {
    throw createError({
      statusCode: 401,
      message: 'Not authenticated'
    })
  }

  const config = useRuntimeConfig()
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

  const url = new URL(`${config.apiUrl || config.public.apiUrl}/api/messages`)
  if (channelIdParam) {
    url.searchParams.set('channelId', channelIdParam)
  }
  if (pageParam) {
    url.searchParams.set('page', pageParam)
  }
  if (sizeParam) {
    url.searchParams.set('size', sizeParam)
  }

  try {
    const messages = await $fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${session.token}`
      }
    })
    return messages
  } catch (error: unknown) {
    console.error('Failed to fetch messages:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch messages'
    })
  }
})
