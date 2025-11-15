import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event): Promise<unknown> => {
  const { token } = event.context.params as { token: string }
  const config = useRuntimeConfig()
  const body = await readBody(event)

  try {
    const apiUrl = config.apiUrl || config.public.apiUrl
    console.log('Registering with invite:', token, 'to URL:', `${apiUrl}/api/invites/${token}/register`)

    const response: unknown = await $fetch<unknown>(`${apiUrl}/api/invites/${token}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://frontend:3000'
      },
      body
    })
    return response
  } catch (error: unknown) {
    console.error('Registration error:', error)
    let status = 500
    let message = 'Failed to register with invite'
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
