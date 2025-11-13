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
    // Call backend to refresh token
    const response = await $fetch<{
      token: string
      userId: string | number
      username: string
      email: string
      role: string
      avatar?: string
    }>(`${config.public.apiUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.token}`
      }
    })

    if (!response.token) {
      throw createError({
        statusCode: 401,
        message: 'Token refresh failed'
      })
    }

    // Update session with new token
    await replaceUserSession(event, {
      user: {
        userId: typeof response.userId === 'string' ? parseInt(response.userId) : response.userId,
        username: response.username,
        email: response.email,
        role: response.role,
        avatar: response.avatar
      },
      token: response.token,
      loggedInAt: session.loggedInAt,
      refreshedAt: new Date()
    })

    return {
      success: true
    }
  } catch (error: unknown) {
    console.error('Token refresh error:', error)

    // Clear invalid session
    await clearUserSession(event)

    throw createError({
      statusCode: 401,
      message: 'Session expired'
    })
  }
})
