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
  let channelIdParam: string | undefined

  if (typeof channelIdRaw === 'string' && channelIdRaw.trim() !== '') {
    // basic numeric validation; backend expects a number id
    if (/^\d+$/.test(channelIdRaw)) {
      channelIdParam = channelIdRaw
    } else {
      console.warn('[messages:index.get] Ignoring invalid channelId query param:', channelIdRaw)
    }
  }

  // Build URL with optional channelId
  const url = new URL(`${config.public.apiUrl}/api/messages`)
  if (channelIdParam) {
    url.searchParams.set('channelId', channelIdParam)
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
