import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event): Promise<unknown> => {
  try {
    const formData = await readMultipartFormData(event)

    if (!formData) {
      throw createError({
        statusCode: 400,
        message: 'No form data provided'
      })
    }

    const backendFormData = new FormData()

    for (const part of formData) {
      if (part.filename) {
        const arrayBuffer = part.data.buffer.slice(
          part.data.byteOffset,
          part.data.byteOffset + part.data.byteLength
        ) as ArrayBuffer
        const blob = new Blob([arrayBuffer], { type: part.type })
        backendFormData.append(part.name || 'file', blob, part.filename)
      } else {
        backendFormData.append(part.name || 'field', part.data.toString())
      }
    }

    const $api = await createValidatedFetch(event)
    return await $api<unknown>('/api/soundboard/sounds', {
      method: 'POST',
      body: backendFormData
    })
  } catch (error) {
    console.error('Soundboard upload error:', error)
    if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 401) {
      throw error
    }
    throw createError({
      statusCode: 500,
      message: 'Failed to upload sound',
      data: error
    })
  }
})
