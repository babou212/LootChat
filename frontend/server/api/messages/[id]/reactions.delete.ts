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
  const body = await readBody(event)

  try {
    await $fetch(`${config.public.apiUrl}/api/messages/${messageId}/reactions`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${session.token}`
      },
      body
    })
    return { success: true }
  } catch (error: unknown) {
    console.error('Failed to remove reaction:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to remove reaction'
    })
  }
})
