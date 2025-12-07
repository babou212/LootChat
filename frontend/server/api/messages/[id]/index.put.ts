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
  const messageId = getRouterParam(event, 'id')
  const $api = await createValidatedFetch(event)

  try {
    const response: MessageResponse = await $api<MessageResponse>(`/api/messages/${messageId}`, {
      method: 'PUT',
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
