import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event): Promise<unknown> => {
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
    const invite: unknown = await $fetch<unknown>(`${config.public.apiUrl}/api/invites`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.token}`
      },
      body
    })
    return invite
  } catch (error: unknown) {
    console.error('Failed to create invite:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to create invite'
    })
  }
})
