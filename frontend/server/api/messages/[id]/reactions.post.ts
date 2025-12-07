import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event): Promise<unknown> => {
  const messageId = getRouterParam(event, 'id')
  const body = await readBody(event)
  const $api = await createValidatedFetch(event)

  try {
    const reaction: unknown = await $api<unknown>(`/api/messages/${messageId}/reactions`, {
      method: 'POST',
      body
    })
    return reaction
  } catch (error: unknown) {
    console.error('Failed to add reaction:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to add reaction'
    })
  }
})
