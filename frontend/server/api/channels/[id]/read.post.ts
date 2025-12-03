export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Channel ID is required'
    })
  }

  const authFetch = await createValidatedFetch(event)

  try {
    await authFetch(`/api/channels/${id}/read`, {
      method: 'POST'
    })
    return { success: true }
  } catch {
    throw createError({
      statusCode: 500,
      message: 'Failed to mark channel as read'
    })
  }
})
