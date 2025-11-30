import { z } from 'zod'

const forgotPasswordSchema = z.object({
  email: z.string()
    .email('Invalid email address')
    .max(255, 'Email is too long')
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  let data
  try {
    data = forgotPasswordSchema.parse(body)
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        message: err.issues[0]?.message || 'Invalid input'
      })
    }
    throw createError({
      statusCode: 400,
      message: 'Invalid input'
    })
  }

  try {
    const config = useRuntimeConfig()
    const apiUrl = config.apiUrl || config.public.apiUrl

    const response = await $fetch<{
      success: boolean
      message: string
    }>(`${apiUrl}/api/auth/password/forgot`, {
      method: 'POST',
      body: {
        email: data.email
      }
    })

    return {
      success: response.success,
      message: response.message
    }
  } catch (error: unknown) {
    const statusCode = error && typeof error === 'object' && 'statusCode' in error
      ? (error as { statusCode?: number }).statusCode || 500
      : 500
    const message = error && typeof error === 'object' && 'data' in error
      ? ((error as { data?: { message?: string } }).data?.message || 'Failed to process request')
      : 'Failed to process request'

    throw createError({
      statusCode,
      message
    })
  }
})
