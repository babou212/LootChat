export default defineEventHandler(async (event) => {
  const channelId = getRouterParam(event, 'id')
  const $api = await createValidatedFetch(event)

  try {
    await $api(`/api/channels/${channelId}`, {
      method: 'DELETE'
    })
    return { success: true }
  } catch {
    throw createError({
      statusCode: 500,
      message: 'Failed to delete channel'
    })
  }
})
