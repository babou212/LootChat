import type { H3Event } from 'h3'

/**
 * Presence heartbeat endpoint.
 * Proxies to backend to refresh the user's presence TTL.
 */
export default defineEventHandler(async (event: H3Event): Promise<{ success: boolean }> => {
  try {
    const $api = await createValidatedFetch(event)
    await $api('/api/users/presence/heartbeat', {
      method: 'POST'
    })

    return { success: true }
  } catch (error: unknown) {
    console.error('Failed to send presence heartbeat:', error)
    // Don't throw - heartbeat failures shouldn't break the UI
    return { success: false }
  }
})
