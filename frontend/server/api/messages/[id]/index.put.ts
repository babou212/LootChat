import type { H3Event } from 'h3'

interface MessageResponse {
  id: number
  content: string
  userId: number
  username: string
  createdAt: string
  updatedAt: string
  avatar: string
  imageUrl?: string
  imageFilename?: string
  channelId: number
  channelName: string
}

export default defineEventHandler(async (event: H3Event): Promise<MessageResponse> => {
  const session = await getUserSession(event)

  if (!session || !session.token) {
    throw createError({
      statusCode: 401,
      message: 'Not authenticated'
    })
  }

  const config = useRuntimeConfig()
  const messageId = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!body.content || typeof body.content !== 'string') {
    throw createError({
      statusCode: 400,
      message: 'Content is required'
    })
  }

  try {
    const response: MessageResponse = await $fetch<MessageResponse>(`${config.apiUrl || config.public.apiUrl}/api/messages/${messageId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      },
      body: {
        content: body.content
      }
    })
    return response
  } catch (error: unknown) {
    console.error('Failed to update message:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to update message'
    })
  }
})
