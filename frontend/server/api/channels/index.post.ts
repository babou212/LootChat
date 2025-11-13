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
    const channel = await $fetch(`${config.public.apiUrl}/api/channels`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.token}`
      },
      body
    })
    return channel
  } catch (error: unknown) {
    console.error('Failed to create channel:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to create channel'
    })
  }
})
