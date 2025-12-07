import { z } from 'zod'

const reactionSchema = z.object({
  emoji: z.string().min(1)
})

export default defineEventHandler(async (event) => {
  const messageId = getRouterParam(event, 'id')
  const body = await readValidatedBody(event, reactionSchema.parse)
  const $api = await createValidatedFetch(event)

  const response = await $api<{
    id: number
    emoji: string
    userId: number
    username: string
    messageId: number
    createdAt: string
  }>(`/api/direct-messages/messages/${messageId}/reactions`, {
    method: 'POST',
    body
  })

  return response
})
