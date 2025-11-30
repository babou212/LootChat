import { z } from 'zod'

const verifyOtpSchema = z.object({
  email: z.string()
    .email('Invalid email address')
    .max(255, 'Email is too long'),
  otp: z.string()
    .length(6, 'OTP must be 6 digits')
    .regex(/^\d+$/, 'OTP must contain only numbers')
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  let data
  try {
    data = verifyOtpSchema.parse(body)
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
    }>(`${apiUrl}/api/auth/password/verify-otp`, {
      method: 'POST',
      body: {
        email: data.email,
        otp: data.otp
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
      ? ((error as { data?: { message?: string } }).data?.message || 'Failed to verify OTP')
      : 'Failed to verify OTP'

    throw createError({
      statusCode,
      message
    })
  }
})
