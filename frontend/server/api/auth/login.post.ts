import { z } from 'zod'

const loginSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be less than 50 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores and hyphens'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(255, 'Password is too long')
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
    // Use internal API URL for server-side requests
    const apiUrl = config.apiUrl || config.public.apiUrl
    
    const response = await $fetch<{
      userId: string | number
      token: string
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
      throw createError({
        statusCode: 401,
        message: 'Authentication failed'
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
      loggedInAt: new Date()
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
    const statusCode = error && typeof error === 'object' && 'statusCode' in error
      ? (error as { statusCode?: number }).statusCode || 401
      : 401

    throw createError({
      statusCode,
      message: 'Invalid credentials'
    })
  }
})
