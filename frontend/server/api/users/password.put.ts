export default defineEventHandler(async (event) => {
  // Validate request body
  const validatedBody = await validateBody(event, changePasswordSchema)
  const $api = await createValidatedFetch(event)

  try {
    const response = await $api('/api/users/password', {
      method: 'PUT',
      body: validatedBody
    })

    return { success: true }
  } catch {
    throw createError({
      statusCode: 500,
      message: 'Failed to change password'
    })
  }
})
