export default defineEventHandler(async (event) => {
  const { token } = event.context.params as { token: string }
  const config = useRuntimeConfig()

  // Attempt to include auth if present (may not be required for validation)
  let authHeader: Record<string, string> = {}
  try {
    const session = await getUserSession(event)
    if (session?.token) {
      authHeader = { Authorization: `Bearer ${session.token}` }
    }
  } catch {
    // Ignore session retrieval errors
  }

  try {
    const inviteValidation = await $fetch(`${config.public.apiUrl}/api/invites/${token}`, {
      headers: {
        ...authHeader
      }
    })
    return inviteValidation
  } catch (error: unknown) {
    let status = 500
    let message = 'Failed to validate invite'
    if (typeof error === 'object' && error) {
      const maybe = error as Record<string, unknown>
      const statusCode = typeof maybe.statusCode === 'number' ? (maybe.statusCode as number) : undefined
      const response = maybe.response as { status?: number } | undefined
      const data = maybe.data as { message?: string } | undefined
      status = statusCode || response?.status || status
      message = data?.message || message
    }
    throw createError({ statusCode: status, message })
  }
})
