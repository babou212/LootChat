import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event): Promise<unknown> => {
  const body = await readBody(event)
  const $api = await createValidatedFetch(event)

  try {
    const invite: unknown = await $api<unknown>('/api/invites', {
      method: 'POST',
      body
    })
    return invite
  } catch {
    // ignore
  }
})
