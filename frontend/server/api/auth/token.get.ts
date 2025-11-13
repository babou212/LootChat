/**
 * Get the auth token for API calls
 * Used for WebSocket and other client-side authenticated operations
 */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session || !session.token) {
    throw createError({
      statusCode: 401,
      message: 'Not authenticated'
    })
  }

  return {
    token: session.token
  }
})
