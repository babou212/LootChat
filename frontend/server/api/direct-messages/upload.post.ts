export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const cookies = parseCookies(event)
  const token = cookies.token

  if (!token) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  try {
    const formData = await readFormData(event)

    const message: unknown = await $fetch<unknown>(`${config.apiUrl || config.public.apiUrl}/api/direct-messages/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    })

    return message
  }
  catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw createError({
        statusCode: (error as { statusCode: number }).statusCode,
        message: (error as { message?: string }).message || 'Upload failed'
      })
    }
    throw createError({
      statusCode: 500,
      message: 'Failed to upload image'
    })
  }
})
