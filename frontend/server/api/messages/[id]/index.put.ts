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
  const body = await validateBody(event, updateMessageSchema)

  const session = await getUserSession(event)

  if (!session || !session.token) {
    throw createError({
      statusCode: 401,
      message: 'Not authenticated'
    })
  }

  const config = useRuntimeConfig()
  const messageId = getRouterParam(event, 'id')

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
  } catch {
    throw createError({
      statusCode: 500,
      message: 'Failed to update message'
    })
  }
})
