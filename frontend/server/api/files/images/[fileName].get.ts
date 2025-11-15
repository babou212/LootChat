import type { H3Event } from 'h3'

interface RawLikeResponse {
  headers: { get(name: string): string | null }
  _data: unknown
}

export default defineEventHandler(async (event: H3Event): Promise<unknown> => {
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
    const response = (await $fetch.raw(`${backendUrl}/api/files/images/${fileName}`, {
      headers: {
        Authorization: `Bearer ${session.token}`
      }
    })) as unknown as RawLikeResponse

    const headers = response.headers
    if (headers.get('content-type')) {
      setResponseHeader(event, 'Content-Type', headers.get('content-type')!)
    }
    if (headers.get('content-disposition')) {
      setResponseHeader(event, 'Content-Disposition', headers.get('content-disposition')!)
    }
    if (headers.get('cache-control')) {
      setResponseHeader(event, 'Cache-Control', headers.get('cache-control')!)
    }

    return response._data as unknown
  } catch (error: unknown) {
    console.error('Failed to fetch image:', fileName, error)
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch image'
    })
  }
})
