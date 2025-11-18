/**
 * Get the auth token for API calls
 * Used for WebSocket and other client-side authenticated operations
 *
 * SECURITY NOTE: This endpoint should be used sparingly and only when
 * absolutely necessary (e.g., WebSocket connections). For standard HTTP
 * API calls, use server-side endpoints that handle tokens automatically.
 *
 * This endpoint is monitored for security auditing purposes.
 */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const token = await requireSessionToken(event)

  // Security audit logging
  if (process.env.NODE_ENV === 'production') {
    console.warn('[SECURITY AUDIT] JWT token accessed for client use', {
      userId: session?.user?.userId,
      username: session?.user?.username,
      timestamp: new Date().toISOString(),
      userAgent: getHeader(event, 'user-agent')
    })
  }

  return {
    token
  }
})
