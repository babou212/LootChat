import type { H3Event } from 'h3'
import { z } from 'zod'

const createDirectMessageSchema = z.object({
  recipientId: z.number()
})

export default defineEventHandler(async (event: H3Event): Promise<unknown> => {
  const body = await validateBody(event, createDirectMessageSchema)

  try {
    const authFetch = await createValidatedFetch(event)
    return await authFetch('/api/direct-messages', {
      method: 'POST',
      body
    })
  } catch {
    throw createError({
      statusCode: 500,
      message: 'Failed to create direct message'
    })
  }
})
