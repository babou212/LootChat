export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const session = await getUserSession(event)

  if (!session.user) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  try {
    const formData = await readMultipartFormData(event)

    if (!formData) {
      throw createError({
        statusCode: 400,
        message: 'No file provided'
      })
    }

    const backendFormData = new FormData()

    for (const part of formData) {
      if (part.name === 'avatar' && part.data) {
        const arrayBuffer = part.data.buffer.slice(
          part.data.byteOffset,
          part.data.byteOffset + part.data.byteLength
        ) as ArrayBuffer
        const blob = new Blob([arrayBuffer], { type: part.type || 'image/png' })
        backendFormData.append('avatar', blob, part.filename || 'avatar.png')
      }
    }

    const $api = await createValidatedFetch(event)
    const response = await $api<{ avatarUrl: string }>('/api/users/avatar', {
      method: 'POST',
      body: backendFormData
    })

    await setUserSession(event, {
      ...session,
      user: {
        ...session.user,
        avatar: response.avatarUrl
      }
    })

    return response
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Avatar upload error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to upload avatar'
    })
  }
})
