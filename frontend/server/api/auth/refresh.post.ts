/**
 * Refresh the JWT token
 * This endpoint calls the backend to get a new JWT token and updates the session
 */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const token = session?.token

  if (!session?.user || !token) {
    throw createError({
      statusCode: 401,
      message: 'Not authenticated'
    })
  }

  const config = useRuntimeConfig()

  try {
    const response = await $fetch<{
      token: string
      userId: string | number
      username: string
      email: string
      role: string
      avatar?: string
    }>(`${config.apiUrl || config.public.apiUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      }
    })

    if (!response.token) {
      throw createError({
        statusCode: 401,
        message: 'Token refresh failed'
      })
    }

    await replaceUserSession(event, {
      user: {
        userId: typeof response.userId === 'string' ? parseInt(response.userId) : response.userId,
        username: response.username,
        email: response.email,
        role: response.role,
        avatar: response.avatar
      },
      token: response.token,
      loggedInAt: session.loggedInAt
    })

    return {
      success: true
    }
  } catch {
    await clearUserSession(event)

    throw createError({
      statusCode: 401,
      message: 'Session expired'
    })
  }
})
