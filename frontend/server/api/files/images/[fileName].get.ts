import type { H3Event } from 'h3'

interface PresignedUrlResponse {
  url: string
  fileName: string
}

export default defineEventHandler(async (event: H3Event): Promise<PresignedUrlResponse> => {
  const fileName = getRouterParam(event, 'fileName')

  if (!fileName) {
    throw createError({
      statusCode: 400,
      message: 'File name is required'
    })
  }

  const session = await getUserSession(event)
  if (!session?.token) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  const config = useRuntimeConfig()
  const backendUrl = config.apiUrl || config.public.apiUrl

  try {
    // Get presigned URL from backend
    const response = await $fetch<PresignedUrlResponse>(`${backendUrl}/api/files/images/${fileName}`, {
      headers: {
        Authorization: `Bearer ${session.token}`
      }
    })

    return response
  } catch (error: unknown) {
    console.error('Failed to get presigned URL for image:', fileName, error)
    throw createError({
      statusCode: 500,
      message: 'Failed to get image URL'
    })
  }
})
