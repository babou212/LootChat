interface CachedUrl {
  url: string
  expiry: number
}

const avatarUrlCache = new Map<string, CachedUrl>()

export const useAvatarUrl = () => {
  const getAvatarUrl = async (avatarPath: string | undefined): Promise<string> => {
    if (!avatarPath) return ''
    
    const filename = avatarPath.split('/').pop()
    if (!filename) return ''

    const cached = avatarUrlCache.get(filename)
    if (cached && cached.expiry > Date.now()) {
      return cached.url
    }

    try {
      const response = await $fetch<{ url: string, fileName: string }>(`/api/files/images/${filename}`)
      const url = response.url

      avatarUrlCache.set(filename, {
        url,
        expiry: Date.now() + (55 * 60 * 1000) // Cache for 55 minutes
      })

      return url
    } catch (error) {
      console.error('Failed to get avatar presigned URL:', error)
      return ''
    }
  }

  return {
    getAvatarUrl
  }
}
