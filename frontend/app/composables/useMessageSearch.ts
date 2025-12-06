import type { MessageSearchResponse } from '../../shared/types/search'

export const useMessageSearch = () => {
  const loading = ref(false)
  const error = ref<string | null>(null)

  const searchMessages = async (
    query: string,
    channelId?: number,
    page: number = 0,
    size: number = 20
  ): Promise<MessageSearchResponse | null> => {
    if (!query.trim()) {
      return null
    }

    loading.value = true
    error.value = null

    try {
      const params = new URLSearchParams({
        query: query.trim(),
        page: page.toString(),
        size: size.toString()
      })

      if (channelId) {
        params.append('channelId', channelId.toString())
      }

      const data = await $fetch<MessageSearchResponse>(
        `/api/search/messages?${params.toString()}`,
        {
          method: 'GET'
        }
      )

      return data
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to search messages'
      error.value = errorMessage
      console.error('Message search error:', e)
      return null
    } finally {
      loading.value = false
    }
  }

  const reindexMessages = async (): Promise<boolean> => {
    loading.value = true
    error.value = null

    try {
      await $fetch('/api/search/reindex', {
        method: 'POST'
      })

      return true
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to reindex messages'
      error.value = errorMessage
      console.error('Reindex error:', e)
      return false
    } finally {
      loading.value = false
    }
  }

  return {
    searchMessages,
    reindexMessages,
    loading: readonly(loading),
    error: readonly(error)
  }
}
