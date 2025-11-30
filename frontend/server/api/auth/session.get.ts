export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session || !session.user) {
    throw createError({
      statusCode: 401,
      message: 'Not authenticated'
    })
  }

  // Validate that JWT token exists and is still valid
  const token = await getSessionToken(event)
  if (!token) {
    // Session exists but token is missing - clear session
    await clearUserSession(event)
    throw createError({
      statusCode: 401,
      message: 'Invalid session - token missing'
    })
  }

  return {
    user: session.user
  }
})
