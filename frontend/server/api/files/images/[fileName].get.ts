export default defineEventHandler(async (event) => {
  const fileName = getRouterParam(event, 'fileName')

  if (!fileName) {
    throw createError({
      statusCode: 400,
      message: 'File name is required'
    })
  }

  // Get user session
  const session = await getUserSession(event)
  if (!session?.token) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  const config = useRuntimeConfig()
  const backendUrl = config.public.apiUrl || 'http://backend:8080'

  try {
    // Proxy the request to the backend with authentication
    const response = await $fetch.raw(`${backendUrl}/api/files/images/${fileName}`, {
      headers: {
        Authorization: `Bearer ${session.token}`
      }
    })

    // Forward the response headers
    const headers = response.headers
    if (headers.get('content-type')) {
      setResponseHeader(event, 'Content-Type', headers.get('content-type')!)
    }
    if (headers.get('content-disposition')) {
      setResponseHeader(event, 'Content-Disposition', headers.get('content-disposition')!)
    }
    if (headers.get('cache-control')) {
      setResponseHeader(event, 'Cache-Control', headers.get('cache-control')!)
    }

    // Return the image data
    return response._data
  } catch (error: unknown) {
    console.error('Failed to fetch image:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch image'
    })
  }
})
