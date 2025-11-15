export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session || !session.token) {
    throw createError({
      statusCode: 401,
      message: 'Not authenticated'
    })
  }

  const config = useRuntimeConfig()
  const messageId = getRouterParam(event, 'id')

  try {
    await $fetch(`${config.apiUrl || config.public.apiUrl}/api/messages/${messageId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${session.token}`
      }
    })
    return { success: true }
  } catch (error: unknown) {
    console.error('Failed to delete message:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to delete message'
    })
  }
})
