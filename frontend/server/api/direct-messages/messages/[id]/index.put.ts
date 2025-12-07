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
  const messageId = getRouterParam(event, 'id')
  const body = await readValidatedBody(event, updateMessageSchema.parse)
  const $api = await createValidatedFetch(event)

  const response = await $api<DirectMessageMessageResponse>(`/api/direct-messages/messages/${messageId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${session.token}`,
      'Content-Type': 'application/json'
    },
    body
  })

  return response
})
