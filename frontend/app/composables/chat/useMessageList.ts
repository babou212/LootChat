import type { Ref, ComputedRef } from 'vue'
import { ref, computed, unref, nextTick } from 'vue'
import { useVirtualizer, elementScroll, type VirtualizerOptions } from '@tanstack/vue-virtual'
import { useAuthStore } from '../../../stores/auth'
import { useAvatarStore } from '../../../stores/avatars'

export interface MessageListConfig {
  deleteEndpoint: (messageId: number) => string
  editEndpoint: (messageId: number) => string
  reactionEndpoint: (messageId: number) => string
  userIdField: 'userId' | 'senderId'
  usernameField: 'username' | 'senderUsername'
  avatarField: 'avatar' | 'senderAvatar'
  showUserProfile: boolean
  showMentions: boolean
}

export interface BaseMessage {
  id: number
  content: string
  timestamp: Date
  imageUrl?: string
  imageFilename?: string
  replyToMessageId?: number
  replyToUsername?: string
  replyToContent?: string
  edited?: boolean
  deleted?: boolean
  updatedAt?: Date
  reactions?: BaseReaction[]
}

export interface BaseReaction {
  id: number
  emoji: string
  userId: number
  username: string
  createdAt: Date
  messageId?: number
}

export function useMessageList<TMessage extends BaseMessage, TReaction extends BaseReaction>(
  messagesRef: Ref<TMessage[]> | ComputedRef<TMessage[]>,
  containerRef: Ref<HTMLElement | null>,
  config: MessageListConfig
) {
  const authStore = useAuthStore()
  const toast = useToast()
  const avatarStore = useAvatarStore()

  // Trigger to force reactivity updates when reactions change
  const reactionUpdateTrigger = ref(0)

  const presignedUrlCache = ref<Map<string, { url: string, expiry: number }>>(new Map())
  const imageUrls = ref<Map<string, string>>(new Map())

  const getAuthenticatedImageUrl = async (imageUrl: string): Promise<string> => {
    if (!imageUrl) return ''
    const filename = imageUrl.split('/').pop()
    if (!filename) return ''

    const cached = presignedUrlCache.value.get(filename)
    if (cached && cached.expiry > Date.now()) {
      return cached.url
    }

    try {
      const response = await $fetch<{ url: string, fileName: string }>(`/api/files/images/${filename}`)
      presignedUrlCache.value.set(filename, {
        url: response.url,
        expiry: Date.now() + (55 * 60 * 1000)
      })
      return response.url
    } catch (error) {
      console.error('Failed to get presigned URL:', error)
      return ''
    }
  }

  const loadImageUrl = async (imageUrl: string) => {
    if (!imageUrl) return
    const filename = imageUrl.split('/').pop()
    if (!filename) return

    if (!imageUrls.value.has(filename)) {
      const url = await getAuthenticatedImageUrl(imageUrl)
      imageUrls.value.set(filename, url)
    }
  }

  const getLoadedImageUrl = (imageUrl: string): string => {
    if (!imageUrl) return ''
    const filename = imageUrl.split('/').pop()
    if (!filename) return ''
    return imageUrls.value.get(filename) || ''
  }

  const getLoadedAvatarUrl = (userId: string | number): string => {
    return avatarStore.getAvatarUrl(Number(userId)) || ''
  }

  const scrollingRef = ref<number>()
  // Include reactionUpdateTrigger in the dependency to force re-computation when reactions change
  const visibleMessages = computed(() => {
    // Access trigger to create dependency
    void reactionUpdateTrigger.value
    return (unref(messagesRef) as TMessage[]).filter(m => !m.deleted)
  })

  const easeInOutQuint = (t: number) => {
    return t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * --t * t * t * t * t
  }

  const scrollToFn: VirtualizerOptions<HTMLElement, Element>['scrollToFn'] = (
    offset,
    options,
    instance
  ) => {
    if (options.behavior !== 'smooth') {
      elementScroll(offset, options, instance)
      return
    }

    const duration = 500
    const start = containerRef.value?.scrollTop || 0
    const startTime = (scrollingRef.value = Date.now())

    const run = () => {
      if (scrollingRef.value !== startTime) return
      const now = Date.now()
      const elapsed = now - startTime
      const progress = easeInOutQuint(Math.min(elapsed / duration, 1))
      const interpolated = start + (offset - start) * progress

      if (elapsed < duration) {
        elementScroll(interpolated, options, instance)
        requestAnimationFrame(run)
      } else {
        elementScroll(offset, options, instance)
      }
    }
    requestAnimationFrame(run)
  }

  const virtualizer = useVirtualizer({
    get count() {
      return visibleMessages.value.length
    },
    getScrollElement: () => containerRef.value,
    estimateSize: () => 150,
    overscan: 5,
    getItemKey: index => visibleMessages.value[index]?.id || index,
    scrollToFn,
    measureElement: element => element.getBoundingClientRect().height
  })

  const virtualRows = computed(() => virtualizer.value.getVirtualItems())

  const getMessage = (virtualIndex: number): TMessage | undefined => {
    return visibleMessages.value[virtualIndex]
  }

  // ============ Scrolling ============
  const isNearBottom = () => {
    const container = containerRef.value
    if (!container) return false
    const threshold = 200
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold
  }

  const scrollToBottom = (smooth = false) => {
    if (visibleMessages.value.length === 0) return
    virtualizer.value.scrollToIndex(visibleMessages.value.length - 1, {
      align: 'end',
      behavior: smooth ? 'smooth' : 'auto'
    })
  }

  const scrollToBottomWhenReady = async () => {
    const container = containerRef.value
    if (!container) return

    const images = container.querySelectorAll('img')
    const imagePromises = Array.from(images).map((img) => {
      if (img.complete) return Promise.resolve()
      return new Promise((resolve) => {
        img.onload = resolve
        img.onerror = resolve
        setTimeout(resolve, 500)
      })
    })

    await Promise.all(imagePromises)
    await new Promise(resolve => setTimeout(resolve, 50))
    scrollToBottom()
  }

  const scrollToMessage = (messageId: number) => {
    // Find the index of the message in visibleMessages
    const messageIndex = visibleMessages.value.findIndex(m => m.id === messageId)

    if (messageIndex !== -1) {
      console.log('[useMessageList] Scrolling to message index:', messageIndex, 'of', visibleMessages.value.length)
      virtualizer.value.scrollToIndex(messageIndex, {
        align: 'center',
        behavior: 'auto'
      })
    } else {
      console.warn('[useMessageList] Message not found in visible messages:', messageId)
      const messageElement = document.querySelector(`[data-message-id="${messageId}"]`)
      if (messageElement) {
        messageElement.scrollIntoView({ behavior: 'auto', block: 'center' })
      }
    }
  }

  const activeEmojiPicker = ref<number | null>(null)
  const emojiPickerRef = ref<HTMLElement | null>(null)
  const openEmojiUpwards = ref(false)
  const emojiAnchorEl = ref<HTMLElement | null>(null)
  const emojiPickerPosition = ref({ top: 0, left: 0 })
  const emojiPickerHeight = ref(435)
  const PICKER_WIDTH = 352

  const toggleEmojiPicker = (messageId: number, event?: MouseEvent) => {
    if (activeEmojiPicker.value === messageId) {
      closeEmojiPicker()
      return
    }

    activeEmojiPicker.value = messageId
    emojiAnchorEl.value = (event?.currentTarget as HTMLElement) || null

    nextTick(() => {
      const anchor = emojiAnchorEl.value
      if (!anchor) return

      const anchorRect = anchor.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const viewportWidth = window.innerWidth
      const pickerHeight = emojiPickerHeight.value

      // Calculate space available
      const spaceBelow = viewportHeight - anchorRect.bottom - 8
      const spaceAbove = anchorRect.top - 8

      // Decide whether to open upwards or downwards
      openEmojiUpwards.value = spaceBelow < pickerHeight && spaceAbove > spaceBelow

      // Calculate horizontal position
      let left = anchorRect.left
      // Prevent overflow on right side
      if (left + PICKER_WIDTH > viewportWidth - 16) {
        left = viewportWidth - PICKER_WIDTH - 16
      }
      // Prevent overflow on left side
      if (left < 16) left = 16

      // Calculate vertical position with bounds checking
      let top: number
      if (openEmojiUpwards.value) {
        // Open upwards - position above the button with spacing
        top = anchorRect.top - pickerHeight - 12
        // If it would go above viewport, clamp to top with some padding
        if (top < 8) {
          top = 8
          // Adjust height if needed
          const availableHeight = anchorRect.top - 20
          if (availableHeight < pickerHeight) {
            emojiPickerHeight.value = Math.max(300, availableHeight)
          }
        }
      } else {
        // Open downwards - position below the button with spacing
        top = anchorRect.bottom + 12
        // If it would go below viewport, adjust
        if (top + pickerHeight > viewportHeight - 8) {
          const availableHeight = viewportHeight - anchorRect.bottom - 20
          if (availableHeight < pickerHeight) {
            // Not enough space below, try to fit what we can
            emojiPickerHeight.value = Math.max(300, availableHeight)
          }
        }
      }

      emojiPickerPosition.value = { top, left }
    })
  }

  const closeEmojiPicker = () => {
    activeEmojiPicker.value = null
    openEmojiUpwards.value = false
    emojiAnchorEl.value = null
    emojiPickerHeight.value = 435 // Reset to default
  }

  useClickAway(emojiPickerRef, closeEmojiPicker)

  const inFlightReactions = new Set<string>()

  const handleReactionClick = async (messageId: number, emoji: string) => {
    const currentUser = authStore.user
    if (!currentUser) return

    const messages = unref(messagesRef) as TMessage[]
    const message = messages.find(m => m.id === messageId)
    if (!message) return

    if (!Array.isArray(message.reactions)) message.reactions = []

    const key = `${messageId}:${emoji}`
    if (inFlightReactions.has(key)) return
    inFlightReactions.add(key)

    const existingIndex = message.reactions.findIndex(
      r => r.emoji === emoji && r.userId === Number(currentUser.userId)
    )

    if (existingIndex !== -1) {
      const removed = message.reactions[existingIndex]!
      message.reactions.splice(existingIndex, 1)
      reactionUpdateTrigger.value++ // Trigger reactivity update
      try {
        await $fetch(config.reactionEndpoint(messageId), {
          method: 'DELETE',
          body: { emoji }
        })
      } catch (error) {
        console.error('Error removing reaction:', error)
        message.reactions.splice(existingIndex, 0, removed)
        reactionUpdateTrigger.value++ // Trigger reactivity update
      } finally {
        inFlightReactions.delete(key)
      }
      return
    }

    const tempId = -Date.now()
    const tempReaction = {
      id: tempId,
      emoji,
      userId: Number(currentUser.userId),
      username: currentUser.username,
      createdAt: new Date(),
      messageId
    } as TReaction
    message.reactions.push(tempReaction)
    reactionUpdateTrigger.value++

    try {
      const serverReaction = await $fetch<TReaction>(config.reactionEndpoint(messageId), {
        method: 'POST',
        body: { emoji }
      })
      const serverIdx = message.reactions.findIndex(r => r.id === serverReaction.id)
      const tempIdx = message.reactions.findIndex(r => r.id === tempId)
      if (serverIdx !== -1 && tempIdx !== -1) {
        message.reactions.splice(tempIdx, 1)
        reactionUpdateTrigger.value++ // Trigger reactivity update
      } else if (tempIdx !== -1) {
        message.reactions[tempIdx] = serverReaction
        reactionUpdateTrigger.value++ // Trigger reactivity update
      } else if (serverIdx === -1) {
        message.reactions.push(serverReaction)
        reactionUpdateTrigger.value++ // Trigger reactivity update
      }
    } catch (error) {
      console.error('Error adding reaction:', error)
      const idx = message.reactions.findIndex(r => r.id === tempId)
      if (idx !== -1) {
        message.reactions.splice(idx, 1)
        reactionUpdateTrigger.value++ // Trigger reactivity update
      }
    } finally {
      inFlightReactions.delete(key)
    }
  }

  const handleEmojiSelect = async (messageId: number, emoji: string) => {
    await handleReactionClick(messageId, emoji)
    closeEmojiPicker()
  }

  const groupReactions = (reactions: TReaction[] = []) => {
    const grouped = new Map<string, {
      emoji: string
      count: number
      userIds: number[]
      usernames: string[]
    }>()

    reactions.forEach((reaction) => {
      const existing = grouped.get(reaction.emoji)
      if (existing) {
        existing.count++
        existing.userIds.push(reaction.userId)
        existing.usernames.push(reaction.username)
      } else {
        grouped.set(reaction.emoji, {
          emoji: reaction.emoji,
          count: 1,
          userIds: [reaction.userId],
          usernames: [reaction.username]
        })
      }
    })

    return Array.from(grouped.values())
  }

  const hasUserReacted = (userIds: number[]) => {
    return authStore.user?.userId ? userIds.includes(Number(authStore.user.userId)) : false
  }

  const editingMessageId = ref<number | null>(null)

  const startEdit = (message: TMessage) => {
    editingMessageId.value = message.id
    closeEmojiPicker()
  }

  const cancelEdit = () => {
    editingMessageId.value = null
  }

  const saveEdit = async (messageId: number, content: string) => {
    try {
      const response = await fetch(config.editEndpoint(messageId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      })

      if (!response.ok) {
        throw new Error('Failed to edit message')
      }

      const messages = unref(messagesRef) as TMessage[]
      const message = messages.find(m => m.id === messageId)
      if (message) {
        message.content = content
        message.edited = true
        message.updatedAt = new Date()
      }

      cancelEdit()
      toast.add({
        title: 'Message updated',
        description: 'Your message has been edited',
        color: 'success',
        icon: 'i-lucide-check'
      })
    } catch (err) {
      console.error('Failed to edit message:', err)
      toast.add({
        title: 'Failed to edit',
        description: 'Please try again.',
        color: 'warning',
        icon: 'i-lucide-alert-triangle'
      })
    }
  }

  const handleDeleteMessage = (message: TMessage, username: string, onDeleted: (id: number) => void) => {
    const performDelete = async () => {
      try {
        await $fetch(config.deleteEndpoint(message.id), { method: 'DELETE' })
        onDeleted(message.id)
        toast.add({
          title: 'Message deleted',
          description: `Removed message by ${username}`,
          color: 'error',
          icon: 'i-lucide-trash-2'
        })
      } catch (err) {
        console.error('Failed to delete message:', err)
        toast.add({
          title: 'Failed to delete',
          description: 'Please try again.',
          color: 'warning',
          icon: 'i-lucide-alert-triangle'
        })
      }
    }

    toast.add({
      title: 'Delete this message?',
      description: 'This action cannot be undone.',
      color: 'error',
      icon: 'i-lucide-alert-octagon',
      actions: [
        { label: 'Cancel', color: 'neutral' },
        { label: 'Delete', color: 'error', variant: 'solid', onClick: performDelete }
      ]
    })
  }

  const canDelete = (message: TMessage): boolean => {
    const current = authStore.user
    if (!current || message.deleted) return false
    const msgUserId = (message as Record<string, unknown>)[config.userIdField]
    const isOwner = String(msgUserId) === String(current.userId)
    const isPrivileged = current.role === 'ADMIN' || current.role === 'MODERATOR'
    return isOwner || isPrivileged
  }

  const canEdit = (message: TMessage): boolean => {
    const current = authStore.user
    if (!current || message.deleted) return false
    const msgUserId = (message as Record<string, unknown>)[config.userIdField]
    return String(msgUserId) === String(current.userId)
  }

  const isOptimistic = (message: TMessage): boolean => {
    return message.id < 0
  }

  const expandedImage = ref<string | null>(null)
  const expandedImageAlt = ref<string | null>(null)

  const openImageModal = (imageUrl: string, altText: string) => {
    expandedImage.value = imageUrl
    expandedImageAlt.value = altText
  }

  const closeImageModal = () => {
    expandedImage.value = null
    expandedImageAlt.value = null
  }

  const gifRegex = /(https?:\/\/\S+?\.gif)(?=\s|$)/i
  const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:\S*)/gi

  const firstGifFrom = (text: string): string | null => {
    const m = text.match(gifRegex)
    return m && m[1] ? m[1] : null
  }

  const firstYouTubeFrom = (text: string): string | null => {
    const m = text.match(youtubeRegex)
    return m && m[0] ? m[0] : null
  }

  const contentWithoutMedia = (text: string): string => {
    return text
      .replace(new RegExp(gifRegex, 'gi'), '')
      .replace(new RegExp(youtubeRegex, 'gi'), '')
      .trim()
  }

  const { formatRelativeTime: formatTime } = useTimeFormat()

  const hasInitiallyScrolled = ref(false)
  const isLoadingMore = ref(false)
  const previousScrollHeight = ref(0)
  const scrollAnchorDistance = ref(0)

  // Function to trigger reactivity update when reactions change externally (e.g., from WebSocket)
  const triggerReactionUpdate = () => {
    reactionUpdateTrigger.value++
  }

  return {
    virtualizer,
    virtualRows,
    visibleMessages,
    getMessage,
    isNearBottom,
    scrollToBottom,
    scrollToBottomWhenReady,
    scrollToMessage,
    hasInitiallyScrolled,
    isLoadingMore,
    previousScrollHeight,
    scrollAnchorDistance,
    imageUrls,
    loadImageUrl,
    getLoadedImageUrl,
    getLoadedAvatarUrl,
    activeEmojiPicker,
    emojiPickerRef,
    emojiPickerPosition,
    emojiPickerHeight,
    toggleEmojiPicker,
    closeEmojiPicker,
    handleReactionClick,
    handleEmojiSelect,
    groupReactions,
    hasUserReacted,
    editingMessageId,
    startEdit,
    cancelEdit,
    saveEdit,
    handleDeleteMessage,
    canDelete,
    canEdit,
    isOptimistic,
    expandedImage,
    expandedImageAlt,
    openImageModal,
    closeImageModal,
    firstGifFrom,
    firstYouTubeFrom,
    contentWithoutMedia,
    formatTime,
    authStore,
    triggerReactionUpdate
  }
}
