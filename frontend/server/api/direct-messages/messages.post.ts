import type { H3Event } from 'h3'
import { z } from 'zod'

const sendDirectMessageSchema = z.object({
  content: z.string(),
  directMessageId: z.number(),
  replyToMessageId: z.number().optional(),
  replyToUsername: z.string().optional(),
  replyToContent: z.string().optional(),
  imageUrl: z.string().optional(),
  imageFilename: z.string().optional()
})

export default defineEventHandler(async (event: H3Event): Promise<unknown> => {
  const body = await validateBody(event, sendDirectMessageSchema)

  try {
    const authFetch = await createAuthenticatedFetch(event)
    return await authFetch('/api/direct-messages/messages', {
      method: 'POST',
      body
    })
  } catch {
    throw createError({
      statusCode: 500,
      message: 'Failed to send message'
    })
  }
})
