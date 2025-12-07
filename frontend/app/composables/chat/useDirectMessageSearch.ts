import { directMessageApi } from '../../api/directMessageApi'

export function useDirectMessageSearch() {
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function searchMessages(directMessageId: number, query: string, page = 0, size = 20) {
    loading.value = true
    error.value = null

    try {
      const response = await directMessageApi.searchMessages(directMessageId, query, page, size)
      return response
    } catch (err) {
      console.error('Failed to search direct messages:', err)
      error.value = err instanceof Error ? err.message : 'Failed to search messages'
      return null
    } finally {
      loading.value = false
    }
  }

  return {
    searchMessages,
    loading,
    error
  }
}
