import { z } from 'zod'

const loginSchema = z.object({
  username: z.string(),
  password: z.string()
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  let credentials
  try {
    credentials = loginSchema.parse(body)
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

  const { username, password } = credentials

  try {
    const config = useRuntimeConfig()
    const apiUrl = config.apiUrl || config.public.apiUrl

    const response = await $fetch<{
      userId: string | number
      token: string
      refreshToken?: string
      username: string
      email: string
      role: string
      avatar?: string
      message: string
    }>(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      body: {
        username,
        password
      }
    })

    if (!response.token) {
      const errorMessage = response.message || 'Authentication failed'
      throw createError({
        statusCode: 401,
        message: errorMessage
      })
    }

    await setUserSession(event, {
      user: {
        userId: typeof response.userId === 'string' ? parseInt(response.userId) : response.userId,
        username: response.username,
        email: response.email,
        role: response.role,
        avatar: response.avatar
      },
      token: response.token,
      refreshToken: response.refreshToken,
      loggedInAt: new Date(),
      failedRefreshAttempts: 0
    })

    return {
      success: true,
      user: {
        userId: typeof response.userId === 'string' ? parseInt(response.userId) : response.userId,
        username: response.username,
        email: response.email,
        role: response.role,
        avatar: response.avatar
      }
    }
  } catch (error: unknown) {
    interface ErrorWithData {
      data?: { message?: string }
      message?: string
      statusCode?: number
      status?: number
    }
    const errorObj = error as ErrorWithData
    const message = errorObj?.data?.message || errorObj?.message || 'Invalid credentials'
    const statusCode = errorObj?.statusCode || errorObj?.status || 401

    throw createError({
      statusCode,
      message
    })
  }
})
