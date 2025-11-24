export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const query = getQuery(event)
  const pageRaw = query.page
  const sizeRaw = query.size
  let pageParam: string | undefined
  let sizeParam: string | undefined

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
    if (pageParam) {
      params.set('page', pageParam)
    }
    if (sizeParam) {
      params.set('size', sizeParam)
    }

    const queryString = params.toString()
    const url = queryString
      ? `/api/direct-messages/${id}/messages?${queryString}`
      : `/api/direct-messages/${id}/messages`

    return await authFetch(url) as unknown
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
