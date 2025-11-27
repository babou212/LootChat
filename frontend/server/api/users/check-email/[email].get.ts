import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const email = getRouterParam(event, 'email')

  if (!email) {
    throw createError({
      statusCode: 400,
      message: 'Email is required'
    })
  }

  try {
    const config = useRuntimeConfig(event)
    const apiUrl = config.public.apiUrl || 'http://localhost:8080'
    const url = `${apiUrl}/api/users/check-email/${email}`
    const response = await $fetch<{ exists: boolean }>(url)
    return response
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Failed to check email:', error)
    console.error('Error details:', error.message, error.statusCode)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to check email availability'
    })
  }
})
