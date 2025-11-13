export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session || !session.token) {
    throw createError({
      statusCode: 401,
      message: 'Not authenticated'
    })
  }

  const config = useRuntimeConfig()
  const body = await readBody(event)

  try {
    const message = await $fetch(`${config.public.apiUrl}/api/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.token}`
      },
      body
    })
    return message
  } catch (error: unknown) {
    console.error('Failed to create message:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to create message'
    })
  }
})
