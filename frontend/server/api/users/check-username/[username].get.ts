export default defineEventHandler(async (event) => {
  const username = getRouterParam(event, 'username')

  if (!username) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Username parameter is required'
    })
  }

  try {
    const config = useRuntimeConfig(event)
    const apiUrl = config.apiUrl // Use server-side internal URL
    const backendUrl = `${apiUrl}/api/users/check-username/${username}`

    const response = await $fetch<{ exists: boolean }>(backendUrl, {
      method: 'GET'
    })

    return response
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Failed to check username:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Failed to check username availability'
    })
  }
})
