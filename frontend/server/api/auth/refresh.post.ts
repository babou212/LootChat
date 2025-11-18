/**
 * Refresh the JWT token
 * This endpoint calls the backend to get a new JWT token and updates the session
 */
export default defineEventHandler(async (event) => {
  const token = await requireSessionToken(event)
  const session = await getUserSession(event)

  if (!session?.user) {
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

    // Calculate new token expiration
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

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
      expiresAt
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
