export default defineEventHandler(async (event) => {
  const authFetch = await createAuthenticatedFetch(event)

  try {
    const unreadCounts = await authFetch<Record<number, number>>('/api/channels/unread')
    return unreadCounts
  } catch {
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch unread counts'
    })
  }
})
