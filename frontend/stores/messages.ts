import { defineStore } from 'pinia'
import type { Message } from '../shared/types/chat'
import type { MessageResponse } from '../app/api/messageApi'

/**
 * Messages Store - Manages message caching and state for all channels
 *
 * Features:
 * - Per-channel message caching with 5-minute TTL
 * - Automatic cache invalidation on user actions (send, edit, delete)
 * - WebSocket integration for real-time updates
 * - Memory management (keeps last 10 accessed channels)
 * - Pagination support with seamless loading
 *
 * Usage:
 * ```ts
 * const messagesStore = useMessagesStore()
 *
 * // Fetch messages (uses cache if valid)
 * await messagesStore.fetchMessages(channelId)
 *
 * // Get cached messages
 * const messages = messagesStore.getChannelMessages(channelId)
 *
 * // Add new message (from WebSocket)
 * messagesStore.addMessage(channelId, message)
 * ```
 */

interface ChannelCache {
  messages: Message[]
  currentPage: number
  hasMore: boolean
  lastFetched: number
  totalPages: number
}

interface MessagesState {
  channelCaches: Map<number, ChannelCache>
  pageSize: number
  cacheTTL: number
}

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const PAGE_SIZE = 30

export const useMessagesStore = defineStore('messages', {
  state: (): MessagesState => ({
    channelCaches: new Map(),
    pageSize: PAGE_SIZE,
    cacheTTL: CACHE_TTL
  }),

  getters: {
    getChannelMessages: (state) => {
      return (channelId: number): Message[] => {
        const cache = state.channelCaches.get(channelId)
        return cache?.messages || []
      }
    },

    hasMoreMessages: (state) => {
      return (channelId: number): boolean => {
        const cache = state.channelCaches.get(channelId)
        return cache?.hasMore ?? true
      }
    },

    getCurrentPage: (state) => {
      return (channelId: number): number => {
        const cache = state.channelCaches.get(channelId)
        return cache?.currentPage ?? 0
      }
    },

    isCacheValid: (state) => {
      return (channelId: number): boolean => {
        const cache = state.channelCaches.get(channelId)
        if (!cache) return false

        const now = Date.now()
        const isExpired = now - cache.lastFetched > state.cacheTTL
        return !isExpired
      }
    },

    hasCachedMessages: (state) => {
      return (channelId: number): boolean => {
        const cache = state.channelCaches.get(channelId)
        return cache !== undefined && cache.messages.length > 0
      }
    }
  },

  actions: {
    convertToMessage(apiMessage: MessageResponse): Message {
      const converted = {
        id: apiMessage.id,
        userId: apiMessage.userId.toString(),
        username: apiMessage.username,
        content: apiMessage.content,
        timestamp: new Date(apiMessage.createdAt),
        avatar: apiMessage.avatar,
        imageUrl: apiMessage.imageUrl,
        imageFilename: apiMessage.imageFilename,
        channelId: apiMessage.channelId,
        channelName: apiMessage.channelName,
        reactions: apiMessage.reactions?.map((r: { id: number, emoji: string, userId: number, username: string, createdAt: string }) => ({
          id: r.id,
          emoji: r.emoji,
          userId: r.userId,
          username: r.username,
          createdAt: new Date(r.createdAt)
        })) || [],
        updatedAt: apiMessage.updatedAt ? new Date(apiMessage.updatedAt) : undefined,
        edited: apiMessage.updatedAt ? new Date(apiMessage.updatedAt).getTime() !== new Date(apiMessage.createdAt).getTime() : false,
        replyToMessageId: apiMessage.replyToMessageId,
        replyToUsername: apiMessage.replyToUsername,
        replyToContent: apiMessage.replyToContent
      }

      return converted
    },

    async fetchMessages(channelId: number, page = 0, forceRefresh = false): Promise<Message[]> {
      const cache = this.channelCaches.get(channelId)

      if (!forceRefresh && cache && page === 0 && this.isCacheValid(channelId)) {
        return cache.messages
      }

      try {
        const apiMessages = await fetch('/api/messages?' + new URLSearchParams({
          channelId: channelId.toString(),
          page: page.toString(),
          size: this.pageSize.toString()
        })).then(res => res.json()) as MessageResponse[]

        const convertedMessages = apiMessages
          .map((msg: MessageResponse) => this.convertToMessage(msg))
          .sort((a: Message, b: Message) => a.timestamp.getTime() - b.timestamp.getTime())

        const hasMore = apiMessages.length === this.pageSize

        if (page === 0) {
          this.channelCaches.set(channelId, {
            messages: convertedMessages,
            currentPage: 0,
            hasMore,
            lastFetched: Date.now(),
            totalPages: 1
          })
        } else {
          const existingCache = this.channelCaches.get(channelId)
          if (existingCache) {
            const updatedMessages = [...convertedMessages, ...existingCache.messages]
            this.channelCaches.set(channelId, {
              ...existingCache,
              messages: updatedMessages,
              currentPage: page,
              hasMore,
              totalPages: Math.max(existingCache.totalPages, page + 1)
            })
          }
        }

        return convertedMessages
      } catch (error) {
        console.error('Failed to fetch messages:', error)
        throw error
      }
    },

    addMessage(channelId: number, message: Message) {
      const cache = this.channelCaches.get(channelId)

      if (cache) {
        const exists = cache.messages.find(m => m.id === message.id)
        if (!exists) {
          cache.messages.push(message)
          cache.messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
        } else {
          const index = cache.messages.findIndex(m => m.id === message.id)
          if (index !== -1) {
            cache.messages[index] = message
          }
        }
      } else {
        this.channelCaches.set(channelId, {
          messages: [message],
          currentPage: 0,
          hasMore: true,
          lastFetched: Date.now(),
          totalPages: 1
        })
      }
    },

    /**
     * Add an optimistic message (shown immediately before server confirmation)
     * Uses negative IDs to distinguish from real messages
     */
    addOptimisticMessage(channelId: number, message: Omit<Message, 'id'> & { optimisticId: number }): number {
      const cache = this.channelCaches.get(channelId)
      const optimisticMessage: Message = {
        ...message,
        id: message.optimisticId
      }

      if (cache) {
        cache.messages.push(optimisticMessage)
        cache.messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      } else {
        this.channelCaches.set(channelId, {
          messages: [optimisticMessage],
          currentPage: 0,
          hasMore: true,
          lastFetched: Date.now(),
          totalPages: 1
        })
      }

      return message.optimisticId
    },

    /**
     * Confirm an optimistic message by replacing it with the server response
     */
    confirmOptimisticMessage(channelId: number, optimisticId: number, serverMessage: Message) {
      const cache = this.channelCaches.get(channelId)
      if (!cache) return

      const index = cache.messages.findIndex(m => m.id === optimisticId)
      if (index !== -1) {
        cache.messages[index] = serverMessage
        cache.messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      }
    },

    /**
     * Rollback an optimistic message if sending failed
     */
    rollbackOptimisticMessage(channelId: number, optimisticId: number) {
      const cache = this.channelCaches.get(channelId)
      if (!cache) return

      cache.messages = cache.messages.filter(m => m.id !== optimisticId)
    },

    updateMessage(channelId: number, messageId: number, updates: Partial<Message>) {
      const cache = this.channelCaches.get(channelId)
      if (!cache) return

      const index = cache.messages.findIndex(m => m.id === messageId)
      if (index !== -1) {
        cache.messages[index] = {
          ...cache.messages[index]!,
          ...updates
        }
      }
    },

    removeMessage(channelId: number, messageId: number) {
      const cache = this.channelCaches.get(channelId)
      if (!cache) return

      cache.messages = cache.messages.filter(m => m.id !== messageId)
    },

    removeMessageById(messageId: number) {
      this.channelCaches.forEach((cache) => {
        cache.messages = cache.messages.filter(m => m.id !== messageId)
      })
    },

    addReaction(channelId: number, messageId: number, reaction: { id: number, emoji: string, userId: number, username: string, createdAt: Date }) {
      const cache = this.channelCaches.get(channelId)
      if (!cache) return

      const message = cache.messages.find(m => m.id === messageId)
      if (message) {
        if (!message.reactions) {
          message.reactions = []
        }
        const existingIndex = message.reactions.findIndex(r => r.id === reaction.id)
        if (existingIndex === -1) {
          message.reactions.push(reaction)
        }
      }
    },

    removeReaction(channelId: number, messageId: number, reactionId: number) {
      const cache = this.channelCaches.get(channelId)
      if (!cache) return

      const message = cache.messages.find(m => m.id === messageId)
      if (message && message.reactions) {
        message.reactions = message.reactions.filter(r => r.id !== reactionId)
      }
    },

    clearChannel(channelId: number) {
      this.channelCaches.delete(channelId)
    },

    clearAllCaches() {
      this.channelCaches.clear()
    },

    invalidateChannel(channelId: number) {
      const cache = this.channelCaches.get(channelId)
      if (cache) {
        cache.lastFetched = 0
      }
    },

    pruneOldCaches() {
      if (this.channelCaches.size <= 10) return

      const sortedCaches = Array.from(this.channelCaches.entries())
        .sort((a, b) => b[1].lastFetched - a[1].lastFetched)

      const toKeep = sortedCaches.slice(0, 10)
      this.channelCaches.clear()
      toKeep.forEach(([channelId, cache]) => {
        this.channelCaches.set(channelId, cache)
      })
    }
  }
})
