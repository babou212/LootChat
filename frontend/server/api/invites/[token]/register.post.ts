import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event): Promise<unknown> => {
  const { token } = event.context.params as { token: string }
  const config = useRuntimeConfig()
  const body = await readBody(event)

  try {
    const apiUrl = config.apiUrl || config.public.apiUrl
    const fullUrl = `${apiUrl}/api/invites/${token}/register`
    console.log('Registering with invite:', token, 'to URL:', fullUrl)
    console.log('Request body:', JSON.stringify(body))

    const response: unknown = await $fetch<unknown>(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body,
      // Add more detailed error info
      onRequest({ options }) {
        console.log('Sending request with options:', JSON.stringify(options))
      },
      onResponse({ response }) {
        console.log('Received response status:', response.status)
        console.log('Response headers:', JSON.stringify(response.headers))
      },
      onResponseError({ response }) {
        console.error('Response error status:', response.status)
        console.error('Response error body:', response._data)
      }
    })
    console.log('Registration successful:', response)
    return response
  } catch (error: unknown) {
    console.error('Registration error details:', JSON.stringify(error, null, 2))
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack')
    let status = 500
    let message = 'Failed to register with invite'
    if (typeof error === 'object' && error) {
      const maybe = error as Record<string, unknown>
      const statusCode = typeof maybe.statusCode === 'number' ? (maybe.statusCode as number) : undefined
      const response = maybe.response as { status?: number } | undefined
      const data = maybe.data as { message?: string } | undefined
      status = statusCode || response?.status || status
      message = data?.message || message
      console.error('Parsed error - Status:', status, 'Message:', message)
    }
    throw createError({ statusCode: status, message })
  }
})
