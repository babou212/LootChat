import { z } from 'zod'

const updateMessageSchema = z.object({
  content: z.string().min(1)
})

interface DirectMessageMessageResponse {
  id: number
  content: string
  senderId: number
  senderUsername: string
  senderAvatar?: string
  directMessageId: number
  imageUrl?: string
  imageFilename?: string
  replyToMessageId?: number
  replyToUsername?: string
  replyToContent?: string
  isRead: boolean
  edited?: boolean
  createdAt: string
  updatedAt?: string
  reactions?: Array<{
    id: number
    emoji: string
    userId: number
    username: string
    messageId: number
    createdAt: string
  }>
}

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session || !session.token) {
    throw createError({
      statusCode: 401,
      message: 'Not authenticated'
    })
  }

  const messageId = getRouterParam(event, 'id')
  const body = await readValidatedBody(event, updateMessageSchema.parse)

  const config = useRuntimeConfig()

  const response = await $fetch<DirectMessageMessageResponse>(`${config.apiUrl || config.public.apiUrl}/api/direct-messages/messages/${messageId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${session.token}`,
      'Content-Type': 'application/json'
    },
    body
  })

  return response
})
