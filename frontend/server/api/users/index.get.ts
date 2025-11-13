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
    const users = await $fetch(`${config.public.apiUrl}/api/users`, {
      headers: {
        Authorization: `Bearer ${session.token}`
      }
    })
    return users
  } catch (error: unknown) {
    console.error('Failed to fetch users:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch users'
    })
  }
})
