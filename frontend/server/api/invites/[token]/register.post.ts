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
    console.log('API URL config:', 'apiUrl=', config.apiUrl, 'public.apiUrl=', config.public.apiUrl)

    const response: unknown = await $fetch<unknown>(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body
    })
    return response
  } catch {
    // ignore
  }
})
