export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session || !session.token) {
    throw createError({
      statusCode: 401,
      message: 'Not authenticated'
    })
  }

  const messageId = getRouterParam(event, 'id')

  const config = useRuntimeConfig()

  await $fetch(`${config.apiUrl || config.public.apiUrl}/api/direct-messages/messages/${messageId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${session.token}`
    }
  })

  return null
})
