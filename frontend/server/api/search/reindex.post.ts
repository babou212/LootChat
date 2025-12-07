export default defineEventHandler(async (event): Promise<unknown> => {
  const $api = await createValidatedFetch(event)

  try {
    const response: unknown = await $api('/api/search/reindex', {
      method: 'POST'
    })

    return response
  } catch (error: unknown) {
    const err = error as { statusCode?: number, message?: string }
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.message || 'Reindex failed'
    })
  }
})
