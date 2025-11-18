export default defineEventHandler(async (event) => {
  // Validate request body
  const validatedBody = await validateBody(event, changePasswordSchema)

  const session = await getUserSession(event)

  if (!session || !session.token) {
    throw createError({
      statusCode: 401,
      message: 'Not authenticated'
    })
  }

  const config = useRuntimeConfig()

  try {
    const response = await fetch(`${config.apiUrl || config.public.apiUrl}/api/users/password`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(validatedBody)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw createError({
        statusCode: response.status,
        message: errorData.message || 'Failed to change password'
      })
    }

    return { success: true }
  } catch {
    throw createError({
      statusCode: 500,
      message: 'Failed to change password'
    })
  }
})
