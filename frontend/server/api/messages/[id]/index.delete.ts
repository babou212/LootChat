export default defineEventHandler(async (event) => {
  const messageId = getRouterParam(event, 'id')
  const $api = await createValidatedFetch(event)

  try {
    await $api(`/api/messages/${messageId}`, {
      method: 'DELETE'
    })
    return { success: true }
  } catch (error: unknown) {
    console.error('Failed to delete message:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to delete message'
    })
  }
})
