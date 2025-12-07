export default defineEventHandler(async (event) => {
  const messageId = getRouterParam(event, 'id')
  const body = await readBody(event)
  const $api = await createValidatedFetch(event)

  try {
    await $api(`/api/messages/${messageId}/reactions`, {
      method: 'DELETE',
      body
    })
    return { success: true }
  } catch (error: unknown) {
    console.error('Failed to remove reaction:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to remove reaction'
    })
  }
})
