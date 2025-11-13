export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session || !session.token) {
    throw createError({
      statusCode: 401,
      message: 'Not authenticated'
    })
  }

  const config = useRuntimeConfig()
  const body = await readBody(event)

  try {
    const response = await fetch(`${config.public.apiUrl}/api/users/password`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw createError({
        statusCode: response.status,
        message: errorData.message || 'Failed to change password'
      })
    }

    return { success: true }
  } catch (error: unknown) {
    const err = error as { statusCode?: number }
    if (err.statusCode) {
      throw error
    }
    console.error('Failed to change password:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to change password'
    })
  }
})
