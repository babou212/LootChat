import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event): Promise<unknown> => {
  // Validate request body
  const body = await validateBody(event, createChannelSchema)
  const $api = await createValidatedFetch(event)

  try {
    const channel: unknown = await $api<unknown>('/api/channels', {
      method: 'POST',
      body
    })
    return channel
  } catch {
    throw createError({
      statusCode: 500,
      message: 'Failed to create channel'
    })
  }
})
