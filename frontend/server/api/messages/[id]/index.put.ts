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

  if (!body.content || typeof body.content !== 'string') {
    throw createError({
      statusCode: 400,
      message: 'Content is required'
    })
  }

  try {
    const response = await $fetch(`${config.apiUrl || config.public.apiUrl}/api/messages/${messageId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      },
      body: {
        content: body.content
      }
    })
    return response
  } catch (error: unknown) {
    console.error('Failed to update message:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to update message'
    })
  }
})
