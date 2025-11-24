import { z } from 'zod'

const reactionSchema = z.object({
  emoji: z.string().min(1)
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session || !session.token) {
    throw createError({
      statusCode: 401,
      message: 'Not authenticated'
    })
  }

  const messageId = getRouterParam(event, 'id')
  const body = await readValidatedBody(event, reactionSchema.parse)

  const config = useRuntimeConfig()

  const response = await $fetch<{
    id: number
    emoji: string
    userId: number
    username: string
    messageId: number
    createdAt: string
  }>(`${config.apiUrl || config.public.apiUrl}/api/direct-messages/messages/${messageId}/reactions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.token}`,
      'Content-Type': 'application/json'
    },
    body
  })

  return response
})
