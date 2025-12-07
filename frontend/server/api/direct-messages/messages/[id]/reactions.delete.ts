import { z } from 'zod'

const reactionSchema = z.object({
  emoji: z.string().min(1)
})

export default defineEventHandler(async (event) => {
  const messageId = getRouterParam(event, 'id')
  const body = await readValidatedBody(event, reactionSchema.parse)
  const $api = await createValidatedFetch(event)

  await $api(`/api/direct-messages/messages/${messageId}/reactions`, {
    method: 'DELETE',
    body
  })

  return null
})
