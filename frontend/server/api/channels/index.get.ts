export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session || !session.token) {
    throw createError({
      statusCode: 401,
      message: 'Not authenticated'
    })
  }

  const config = useRuntimeConfig()

  try {
    const channels = await $fetch(`${config.public.apiUrl}/api/channels`, {
      headers: {
        Authorization: `Bearer ${session.token}`
      }
    })
    return channels
  } catch (error: unknown) {
    console.error('Failed to fetch channels:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch channels'
    })
  }
})
