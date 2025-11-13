export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session || !session.token) {
    throw createError({
      statusCode: 401,
      message: 'Not authenticated'
    })
  }

  const config = useRuntimeConfig()
  const formData = await readMultipartFormData(event)

  if (!formData) {
    throw createError({
      statusCode: 400,
      message: 'No form data provided'
    })
  }

  try {
    // Create a new FormData object to forward to backend
    const backendFormData = new FormData()

    for (const part of formData) {
      if (part.filename) {
        // It's a file - convert Buffer to ArrayBuffer
        const arrayBuffer = part.data.buffer.slice(
          part.data.byteOffset,
          part.data.byteOffset + part.data.byteLength
        ) as ArrayBuffer
        const blob = new Blob([arrayBuffer], { type: part.type })
        backendFormData.append(part.name || 'image', blob, part.filename)
      } else {
        // It's a regular field
        backendFormData.append(part.name || 'field', part.data.toString())
      }
    }

    const message = await $fetch(`${config.public.apiUrl}/api/messages/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.token}`
      },
      body: backendFormData
    })
    return message
  } catch (error: unknown) {
    console.error('Failed to upload message with image:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to upload message with image'
    })
  }
})
