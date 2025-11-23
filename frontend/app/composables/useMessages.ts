import { useMessagesStore } from '../../stores/messages'
import type { Message } from '../../shared/types/chat'

export const useMessages = (channelId: Ref<number | null> | number | null = null) => {
  const store = useMessagesStore()

  const messages = computed(() => {
    const id = unref(channelId)
    return id ? store.getChannelMessages(id) : []
  })

  const hasMore = computed(() => {
    const id = unref(channelId)
    return id ? store.hasMoreMessages(id) : true
  })

  const currentPage = computed(() => {
    const id = unref(channelId)
    return id ? store.getCurrentPage(id) : 0
  })

  const isCacheValid = computed(() => {
    const id = unref(channelId)
    return id ? store.isCacheValid(id) : false
  })

  const hasCached = computed(() => {
    const id = unref(channelId)
    return id ? store.hasCachedMessages(id) : false
  })

  const fetchMessages = async (page = 0, forceRefresh = false) => {
    const id = unref(channelId)
    if (!id) throw new Error('Channel ID is required')
    return await store.fetchMessages(id, page, forceRefresh)
  }

  const addMessage = (message: Message) => {
    const id = unref(channelId)
    if (!id) throw new Error('Channel ID is required')
    store.addMessage(id, message)
  }

  const updateMessage = (messageId: number, updates: Partial<Message>) => {
    const id = unref(channelId)
    if (!id) throw new Error('Channel ID is required')
    store.updateMessage(id, messageId, updates)
  }

  const removeMessage = (messageId: number) => {
    const id = unref(channelId)
    if (!id) throw new Error('Channel ID is required')
    store.removeMessage(id, messageId)
  }

  const addReaction = (messageId: number, reaction: { id: number, emoji: string, userId: number, username: string, createdAt: Date }) => {
    const id = unref(channelId)
    if (!id) throw new Error('Channel ID is required')
    store.addReaction(id, messageId, reaction)
  }

  const removeReaction = (messageId: number, reactionId: number) => {
    const id = unref(channelId)
    if (!id) throw new Error('Channel ID is required')
    store.removeReaction(id, messageId, reactionId)
  }

  const clearChannel = () => {
    const id = unref(channelId)
    if (!id) throw new Error('Channel ID is required')
    store.clearChannel(id)
  }

  const invalidateChannel = () => {
    const id = unref(channelId)
    if (!id) throw new Error('Channel ID is required')
    store.invalidateChannel(id)
  }

  const addOptimisticMessage = (message: Omit<Message, 'id'> & { optimisticId: number }) => {
    const id = unref(channelId)
    if (!id) throw new Error('Channel ID is required')
    return store.addOptimisticMessage(id, message)
  }

  const confirmOptimisticMessage = (optimisticId: number, serverMessage: Message) => {
    const id = unref(channelId)
    if (!id) throw new Error('Channel ID is required')
    store.confirmOptimisticMessage(id, optimisticId, serverMessage)
  }

  const rollbackOptimisticMessage = (optimisticId: number) => {
    const id = unref(channelId)
    if (!id) throw new Error('Channel ID is required')
    store.rollbackOptimisticMessage(id, optimisticId)
  }

  return {
    // State
    messages,
    hasMore,
    currentPage,
    isCacheValid,
    hasCached,
    fetchMessages,
    addMessage,
    updateMessage,
    removeMessage,
    addReaction,
    removeReaction,
    clearChannel,
    invalidateChannel,
    addOptimisticMessage,
    confirmOptimisticMessage,
    rollbackOptimisticMessage,
    store
  }
}
