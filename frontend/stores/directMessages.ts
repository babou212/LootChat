import { defineStore } from 'pinia'
import type { DirectMessage, DirectMessageMessage } from '../shared/types/directMessage'
import type { DirectMessageResponse, DirectMessageMessageResponse } from '../app/api/directMessageApi'
import { directMessageApi } from '../app/api/directMessageApi'

interface DirectMessageCache {
  messages: DirectMessageMessage[]
  currentPage: number
  hasMore: boolean
  lastFetched: number
}

interface DirectMessagesState {
  directMessages: DirectMessage[]
  messageCache: Map<number, DirectMessageCache>
  selectedDirectMessageId: number | null
  pageSize: number
  loading: boolean
  error: string | null
}

const PAGE_SIZE = 30

export const useDirectMessagesStore = defineStore('directMessages', {
  state: (): DirectMessagesState => ({
    directMessages: [],
    messageCache: new Map(),
    selectedDirectMessageId: null,
    pageSize: PAGE_SIZE,
    loading: false,
    error: null
  }),

  getters: {
    getSelectedDirectMessage: (state) => {
      if (!state.selectedDirectMessageId) return null
      return state.directMessages.find(dm => dm.id === state.selectedDirectMessageId) || null
    },

    getMessages: (state) => {
      return (directMessageId: number): DirectMessageMessage[] => {
        const cache = state.messageCache.get(directMessageId)
        return cache?.messages || []
      }
    },

    hasMoreMessages: (state) => {
      return (directMessageId: number): boolean => {
        const cache = state.messageCache.get(directMessageId)
        return cache?.hasMore ?? true
      }
    },

    getCurrentPage: (state) => {
      return (directMessageId: number): number => {
        const cache = state.messageCache.get(directMessageId)
        return cache?.currentPage ?? 0
      }
    },

    getTotalUnreadCount: (state) => {
      return state.directMessages.reduce((sum, dm) => sum + dm.unreadCount, 0)
    }
  },

  actions: {
    convertToDirectMessage(apiDm: DirectMessageResponse): DirectMessage {
      return {
        id: apiDm.id,
        otherUserId: apiDm.otherUserId,
        otherUsername: apiDm.otherUsername,
        otherUserAvatar: apiDm.otherUserAvatar,
        lastMessageContent: apiDm.lastMessageContent,
        lastMessageAt: apiDm.lastMessageAt ? new Date(apiDm.lastMessageAt) : undefined,
        unreadCount: apiDm.unreadCount,
        createdAt: new Date(apiDm.createdAt)
      }
    },

    convertToDirectMessageMessage(apiMessage: DirectMessageMessageResponse): DirectMessageMessage {
      return {
        id: apiMessage.id,
        content: apiMessage.content,
        senderId: apiMessage.senderId,
        senderUsername: apiMessage.senderUsername,
        senderAvatar: apiMessage.senderAvatar,
        directMessageId: apiMessage.directMessageId,
        imageUrl: apiMessage.imageUrl,
        imageFilename: apiMessage.imageFilename,
        replyToMessageId: apiMessage.replyToMessageId,
        replyToUsername: apiMessage.replyToUsername,
        replyToContent: apiMessage.replyToContent,
        isRead: apiMessage.isRead,
        timestamp: new Date(apiMessage.createdAt),
        updatedAt: apiMessage.updatedAt ? new Date(apiMessage.updatedAt) : undefined,
        reactions: apiMessage.reactions?.map(r => ({
          id: r.id,
          emoji: r.emoji,
          userId: r.userId,
          username: r.username,
          messageId: r.messageId,
          createdAt: new Date(r.createdAt)
        })) || []
      }
    },

    async fetchAllDirectMessages() {
      this.loading = true
      this.error = null
      try {
        const apiDms = await directMessageApi.getAllDirectMessages()
        this.directMessages = apiDms
          .map(dm => this.convertToDirectMessage(dm))
          .sort((a, b) => {
            const aTime = a.lastMessageAt?.getTime() || 0
            const bTime = b.lastMessageAt?.getTime() || 0
            return bTime - aTime
          })
      } catch (err: unknown) {
        console.error('Failed to fetch direct messages:', err)
        this.error = err instanceof Error ? err.message : 'Failed to fetch direct messages'
      } finally {
        this.loading = false
      }
    },

    async fetchMessages(directMessageId: number, page = 0) {
      try {
        const apiMessages = await directMessageApi.getMessages(directMessageId, page, this.pageSize)

        const convertedMessages = apiMessages
          .map(msg => this.convertToDirectMessageMessage(msg))
          .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

        const hasMore = apiMessages.length === this.pageSize

        if (page === 0) {
          this.messageCache.set(directMessageId, {
            messages: convertedMessages,
            currentPage: 0,
            hasMore,
            lastFetched: Date.now()
          })
        } else {
          const existingCache = this.messageCache.get(directMessageId)
          if (existingCache) {
            const updatedMessages = [...convertedMessages, ...existingCache.messages]
            this.messageCache.set(directMessageId, {
              ...existingCache,
              messages: updatedMessages,
              currentPage: page,
              hasMore
            })
          }
        }

        return convertedMessages
      } catch (error) {
        console.error('Failed to fetch direct messages:', error)
        throw error
      }
    },

    addMessage(directMessageId: number, message: DirectMessageMessage) {
      const cache = this.messageCache.get(directMessageId)

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
        this.messageCache.set(directMessageId, {
          messages: [message],
          currentPage: 0,
          hasMore: true,
          lastFetched: Date.now()
        })
      }

      const dmIndex = this.directMessages.findIndex(dm => dm.id === directMessageId)
      if (dmIndex !== -1) {
        this.directMessages[dmIndex]!.lastMessageContent = message.content
        this.directMessages[dmIndex]!.lastMessageAt = message.timestamp
        this.directMessages.sort((a, b) => {
          const aTime = a.lastMessageAt?.getTime() || 0
          const bTime = b.lastMessageAt?.getTime() || 0
          return bTime - aTime
        })
      }
    },

    addOptimisticMessage(directMessageId: number, message: Omit<DirectMessageMessage, 'id'> & { optimisticId: number }): number {
      const cache = this.messageCache.get(directMessageId)
      const optimisticMessage: DirectMessageMessage = {
        ...message,
        id: message.optimisticId
      }

      if (cache) {
        cache.messages.push(optimisticMessage)
        cache.messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      } else {
        this.messageCache.set(directMessageId, {
          messages: [optimisticMessage],
          currentPage: 0,
          hasMore: true,
          lastFetched: Date.now()
        })
      }

      return message.optimisticId
    },

    confirmOptimisticMessage(directMessageId: number, optimisticId: number, serverMessage: DirectMessageMessage) {
      const cache = this.messageCache.get(directMessageId)
      if (!cache) return

      const index = cache.messages.findIndex(m => m.id === optimisticId)
      if (index !== -1) {
        cache.messages[index] = serverMessage
        cache.messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      }
    },

    rollbackOptimisticMessage(directMessageId: number, optimisticId: number) {
      const cache = this.messageCache.get(directMessageId)
      if (!cache) return

      cache.messages = cache.messages.filter(m => m.id !== optimisticId)
    },

    selectDirectMessage(directMessageId: number) {
      this.selectedDirectMessageId = directMessageId
    },

    async markAsRead(directMessageId: number) {
      try {
        await directMessageApi.markAsRead(directMessageId)

        const dm = this.directMessages.find(d => d.id === directMessageId)
        if (dm) {
          dm.unreadCount = 0
        }

        const cache = this.messageCache.get(directMessageId)
        if (cache) {
          cache.messages.forEach((msg) => {
            if (!msg.isRead) {
              msg.isRead = true
            }
          })
        }
      } catch (error) {
        console.error('Failed to mark as read:', error)
      }
    },

    clearCache(directMessageId: number) {
      this.messageCache.delete(directMessageId)
    },

    /**
     * Mark a message as deleted (soft delete).
     * Preserves the message in the list but marks it as deleted.
     * Also updates any messages that reply to this one.
     */
    markAsDeleted(directMessageId: number, messageId: number) {
      const cache = this.messageCache.get(directMessageId)
      if (!cache) return

      const message = cache.messages.find(m => m.id === messageId)
      if (message) {
        message.deleted = true
        message.content = '[Message deleted]'
        message.imageUrl = undefined
        message.imageFilename = undefined
        message.reactions = []
      }

      // Update any messages that reply to this deleted message
      cache.messages.forEach((m) => {
        if (m.replyToMessageId === messageId) {
          m.replyToContent = '[Message deleted]'
        }
      })
    },

    removeMessage(directMessageId: number, messageId: number) {
      const cache = this.messageCache.get(directMessageId)
      if (!cache) return

      cache.messages = cache.messages.filter(m => m.id !== messageId)
    },

    addReaction(directMessageId: number, messageId: number, reaction: { id: number, emoji: string, userId: number, username: string, messageId: number, createdAt: Date }) {
      const cache = this.messageCache.get(directMessageId)
      if (!cache) return

      const message = cache.messages.find(m => m.id === messageId)
      if (!message) return

      if (!message.reactions) {
        message.reactions = []
      }

      const existingReaction = message.reactions.find(r => r.id === reaction.id)
      if (!existingReaction) {
        message.reactions.push(reaction)
      }
    },

    removeReaction(directMessageId: number, messageId: number, reactionId: number) {
      const cache = this.messageCache.get(directMessageId)
      if (!cache) return

      const message = cache.messages.find(m => m.id === messageId)
      if (!message || !message.reactions) return

      message.reactions = message.reactions.filter(r => r.id !== reactionId)
    },

    updateMessage(directMessageId: number, messageId: number, updates: { content?: string, edited?: boolean }) {
      const cache = this.messageCache.get(directMessageId)
      if (!cache) return

      const message = cache.messages.find(m => m.id === messageId)
      if (!message) return

      if (updates.content !== undefined) {
        message.content = updates.content
      }
      if (updates.edited !== undefined) {
        message.edited = updates.edited
      }
    }
  }
})
