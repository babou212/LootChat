import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event): Promise<unknown> => {
  const { token } = event.context.params as { token: string }
  const config = useRuntimeConfig()
  const body = await readBody(event)

  try {
    const apiUrl = config.apiUrl || config.public.apiUrl
    const fullUrl = `${apiUrl}/api/invites/${token}/register`

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
