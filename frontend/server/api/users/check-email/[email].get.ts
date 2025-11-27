export default defineEventHandler(async (event) => {
  const email = getRouterParam(event, 'email')

  if (!email) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Email parameter is required'
    })
  }

  try {
    const config = useRuntimeConfig(event)
    const apiUrl = config.apiUrl // Use server-side internal URL
    const backendUrl = `${apiUrl}/api/users/check-email/${email}`

    const response = await $fetch<{ exists: boolean }>(backendUrl, {
      method: 'GET'
    })

    return response
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Failed to check email:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Failed to check email availability'
    })
  }
})
