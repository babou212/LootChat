import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event): Promise<unknown> => {
  const { token } = event.context.params as { token: string }
  const config = useRuntimeConfig()

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
    const inviteValidation: unknown = await $fetch<unknown>(`${config.apiUrl || config.public.apiUrl}/api/invites/${token}`, {
      headers: {
        ...authHeader
      }
    })
    return inviteValidation
  } catch {
  // ignore
  }
})
