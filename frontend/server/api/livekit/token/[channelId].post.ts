import { AccessToken } from 'livekit-server-sdk'

/**
 * LiveKit Token Generation API
 *
 * Generates JWT access tokens for LiveKit room connections.
 * Tokens are signed server-side to keep API secrets secure.
 */
export default defineEventHandler(async (event) => {
  // Get channel ID from route params
  const channelId = getRouterParam(event, 'channelId')

  if (!channelId) {
    throw createError({
      statusCode: 400,
      message: 'Channel ID is required'
    })
  }

  // Get user from session/auth
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  const user = session.user as { userId: number, username: string }

  // Get LiveKit configuration from runtime config
  const config = useRuntimeConfig()
  const apiKey = config.livekitApiKey
  const apiSecret = config.livekitApiSecret
  const livekitUrl = config.public.livekitUrl || 'ws://localhost:7880'

  if (!apiKey || !apiSecret) {
    console.error('LiveKit API key or secret not configured')
    throw createError({
      statusCode: 500,
      message: 'LiveKit not configured'
    })
  }

  // Create room name from channel ID
  const roomName = `voice-channel-${channelId}`
  const participantIdentity = user.userId.toString()
  const participantName = user.username

  try {
    // Create access token
    const token = new AccessToken(apiKey, apiSecret, {
      identity: participantIdentity,
      name: participantName,
      // Token expires in 1 hour
      ttl: '1h'
    })

    // Grant permissions for the room
    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true
    })

    // Generate JWT
    const jwt = await token.toJwt()

    return {
      token: jwt,
      url: livekitUrl,
      roomName,
      identity: participantIdentity
    }
  } catch (error) {
    console.error('Error generating LiveKit token:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to generate access token'
    })
  }
})
