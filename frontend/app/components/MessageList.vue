<script setup lang="ts">
import type { Message, Reaction } from '../../shared/types/chat'
import YouTubePlayer from '~/components/YouTubePlayer.vue'
import EmojiPicker from '~/components/EmojiPicker.vue'
import MessageEditor from '~/components/MessageEditor.vue'
import UserProfileCard from '~/components/UserProfileCard.vue'
import type { ReactionResponse } from '~/api/messageApi'
import type { UserPresence } from '~/components/UserPanel.vue'
import { useAuthStore } from '../../stores/auth'
import { useAvatarStore } from '../../stores/avatars'
import { useUserPresenceStore } from '../../stores/userPresence'
import { useVirtualizer, elementScroll, type VirtualizerOptions } from '@tanstack/vue-virtual'

interface Props {
  messages: Message[]
  loading: boolean
  error: string | null
  hasMore?: boolean
  loadingMore?: boolean
}

const props = defineProps<Props>()
const authStore = useAuthStore()
const toast = useToast()
const avatarStore = useAvatarStore()
const userPresenceStore = useUserPresenceStore()

const presignedUrlCache = ref<Map<string, { url: string, expiry: number }>>(new Map())

const getLoadedAvatarUrl = (userId: string | number): string => {
  return avatarStore.getAvatarUrl(Number(userId)) || ''
}

const isOptimistic = (message: Message): boolean => {
  return message.id < 0
}

watch(() => props.messages, (newMessages) => {
  newMessages.forEach((message) => {
    if (message.avatar) {
      avatarStore.loadAvatar(Number(message.userId), message.avatar)
    }
  })
}, { immediate: true, deep: true })

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
    const url = response.url

    presignedUrlCache.value.set(filename, {
      url,
      expiry: Date.now() + (55 * 60 * 1000)
    })

    return url
  } catch (error) {
    console.error('Failed to get presigned URL:', error)
    return ''
  }
}

const imageUrls = ref<Map<string, string>>(new Map())

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

const messagesContainer = ref<HTMLElement | null>(null)
const bottomAnchor = ref<HTMLElement | null>(null)

const easeInOutQuint = (t: number) => {
  return t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * --t * t * t * t * t
}

const scrollingRef = ref<number>()

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
  const start = messagesContainer.value?.scrollTop || 0
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
    return props.messages.length
  },
  getScrollElement: () => messagesContainer.value,
  estimateSize: () => 120,
  overscan: 5,
  getItemKey: index => props.messages[index]?.id || index,
  scrollToFn
})

const isNearBottom = () => {
  const container = messagesContainer.value
  if (!container) return false
  const threshold = 200
  return container.scrollHeight - container.scrollTop - container.clientHeight < threshold
}

const scrollToBottom = (smooth = false) => {
  if (props.messages.length === 0) return
  virtualizer.value.scrollToIndex(props.messages.length - 1, {
    align: 'end',
    behavior: smooth ? 'smooth' : 'auto'
  })
}

const scrollToBottomWhenReady = async () => {
  const container = messagesContainer.value
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

const activeEmojiPicker = ref<number | null>(null)
const emojiPickerRef = ref<HTMLElement | null>(null)
const openEmojiUpwards = ref(false)
const emojiAnchorEl = ref<HTMLElement | null>(null)
const PICKER_HEIGHT_ESTIMATE = 320
const inFlightReactions = new Set<string>()

const editingMessageId = ref<number | null>(null)

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

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && expandedImage.value) {
    closeImageModal()
  }
}

const toggleEmojiPicker = (messageId: number, event?: MouseEvent) => {
  if (activeEmojiPicker.value === messageId) {
    activeEmojiPicker.value = null
    openEmojiUpwards.value = false
    emojiAnchorEl.value = null
    return
  }

  activeEmojiPicker.value = messageId
  emojiAnchorEl.value = (event?.currentTarget as HTMLElement) || null

  nextTick(() => {
    const container = messagesContainer.value
    const anchor = emojiAnchorEl.value
    if (!container || !anchor) return

    const containerRect = container.getBoundingClientRect()
    const anchorRect = anchor.getBoundingClientRect()

    const spaceBelow = containerRect.bottom - anchorRect.bottom
    const spaceAbove = anchorRect.top - containerRect.top

    openEmojiUpwards.value = spaceBelow < PICKER_HEIGHT_ESTIMATE && spaceAbove > spaceBelow
  })
}

const closeEmojiPicker = () => {
  activeEmojiPicker.value = null
  openEmojiUpwards.value = false
  emojiAnchorEl.value = null
}

useClickAway(emojiPickerRef, closeEmojiPicker)

const isLoadingMore = ref(false)
const previousScrollHeight = ref(0)
const scrollAnchorDistance = ref(0)

const virtualRows = computed(() => virtualizer.value.getVirtualItems())

const getMessage = (virtualIndex: number) => {
  return props.messages[virtualIndex]
}

const hasInitiallyScrolled = ref(false)

const handleScroll = () => {
  if (activeEmojiPicker.value !== null) {
    closeEmojiPicker()
  }

  const container = messagesContainer.value
  if (!container) return

  if (!hasInitiallyScrolled.value) return

  const scrollTop = container.scrollTop
  const threshold = 200

  if (
    scrollTop < threshold
    && props.hasMore
    && !props.loadingMore
    && !isLoadingMore.value
  ) {
    previousScrollHeight.value = container.scrollHeight

    isLoadingMore.value = true
    emit('load-more')

    setTimeout(() => {
      isLoadingMore.value = false
    }, 500)
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  if (messagesContainer.value) {
    messagesContainer.value.addEventListener('scroll', handleScroll, { passive: true })
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  if (messagesContainer.value) {
    messagesContainer.value.removeEventListener('scroll', handleScroll)
  }
})

const canDelete = (message: Message) => {
  const current = authStore.user
  if (!current) return false
  const isOwner = String(message.userId) === String(current.userId)
  const isPrivileged = current.role === 'ADMIN' || current.role === 'MODERATOR'
  return isOwner || isPrivileged
}

const canEdit = (message: Message) => {
  const current = authStore.user
  if (!current) return false
  return String(message.userId) === String(current.userId)
}

const startEdit = (message: Message) => {
  editingMessageId.value = message.id
  closeEmojiPicker()
}

const cancelEdit = () => {
  editingMessageId.value = null
}

const saveEdit = async (messageId: number, content: string) => {
  try {
    const response = await fetch(`/api/messages/${messageId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content })
    })

    if (!response.ok) {
      throw new Error('Failed to edit message')
    }

    const message = props.messages.find(m => m.id === messageId)
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

const emit = defineEmits<{
  (e: 'message-deleted', id: number): void
  (e: 'load-more'): void
  (e: 'reply-to-message', message: Message): void
}>()

const handleDeleteMessage = (message: Message) => {
  const performDelete = async () => {
    try {
      await $fetch(`/api/messages/${message.id}`, {
        method: 'DELETE'
      })
      emit('message-deleted', message.id)
      toast.add({
        title: 'Message deleted',
        description: `Removed message by ${message.username}`,
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
      {
        label: 'Cancel',
        color: 'neutral'
      },
      {
        label: 'Delete',
        color: 'error',
        variant: 'solid',
        onClick: performDelete
      }
    ]
  })
}

const handleReactionClick = async (messageId: number, emoji: string) => {
  const currentUser = authStore.user
  if (!currentUser) return

  const message = props.messages.find(m => m.id === messageId)
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
    try {
      await $fetch(`/api/messages/${messageId}/reactions`, {
        method: 'DELETE',
        body: { emoji }
      })
    } catch (error) {
      console.error('Error removing reaction:', error)
      message.reactions.splice(existingIndex, 0, removed)
    } finally {
      inFlightReactions.delete(key)
    }
    return
  }

  const tempId = -Date.now()
  const tempReaction: Reaction = {
    id: tempId,
    emoji,
    userId: Number(currentUser.userId),
    username: currentUser.username,
    createdAt: new Date(),
    messageId
  }
  message.reactions.push(tempReaction)

  try {
    const serverReaction = await $fetch<ReactionResponse>(`/api/messages/${messageId}/reactions`, {
      method: 'POST',
      body: { emoji }
    })
    const serverIdx = message.reactions.findIndex(r => r.id === serverReaction.id)
    const tempIdx = message.reactions.findIndex(r => r.id === tempId)
    if (serverIdx !== -1 && tempIdx !== -1) {
      message.reactions.splice(tempIdx, 1)
    } else if (tempIdx !== -1) {
      message.reactions[tempIdx] = {
        id: serverReaction.id,
        emoji: serverReaction.emoji,
        userId: serverReaction.userId,
        username: serverReaction.username,
        createdAt: new Date(serverReaction.createdAt),
        messageId: serverReaction.messageId
      }
    } else if (serverIdx === -1) {
      message.reactions.push({
        id: serverReaction.id,
        emoji: serverReaction.emoji,
        userId: serverReaction.userId,
        username: serverReaction.username,
        createdAt: new Date(serverReaction.createdAt),
        messageId: serverReaction.messageId
      })
    }
  } catch (error) {
    console.error('Error adding reaction:', error)
    const idx = message.reactions.findIndex(r => r.id === tempId)
    if (idx !== -1) message.reactions.splice(idx, 1)
  } finally {
    inFlightReactions.delete(key)
  }
}

const handleEmojiSelect = async (messageId: number, emoji: string) => {
  await handleReactionClick(messageId, emoji)
  closeEmojiPicker()
}

const handleReplyClick = (message: Message) => {
  emit('reply-to-message', message)
}

const scrollToMessage = (messageId: number) => {
  const messageElement = document.querySelector(`[data-message-id="${messageId}"]`)
  if (messageElement) {
    messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
    messageElement.classList.add('highlight-message')
    setTimeout(() => {
      messageElement.classList.remove('highlight-message')
    }, 2000)
  }
}

const getUserPresence = (message: Message): UserPresence => {
  const userId = Number.parseInt(message.userId)
  const status = userPresenceStore.getUserStatus(userId)

  return {
    userId,
    username: message.username,
    email: '',
    firstName: '',
    lastName: '',
    avatar: message.avatar,
    status: status || 'offline',
    role: 'USER'
  }
}

const groupReactions = (reactions: Reaction[] = []) => {
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

const formatTime = (date: Date) => {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return date.toLocaleDateString()
}

const gifRegex = /(https?:\/\/\S+?\.gif)(?=\s|$)/i
const firstGifFrom = (text: string): string | null => {
  const m = text.match(gifRegex)
  return m && m[1] ? m[1] as string : null
}

const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:\S*)/gi
const firstYouTubeFrom = (text: string): string | null => {
  const m = text.match(youtubeRegex)
  return m && m[0] ? m[0] as string : null
}
const contentWithoutMedia = (text: string): string => {
  return text
    .replace(new RegExp(gifRegex, 'gi'), '')
    .replace(new RegExp(youtubeRegex, 'gi'), '')
    .trim()
}

// Track the channel we're showing messages for to detect channel switches
const currentChannelId = ref<number | null>(null)

// Watch for channel switches by detecting first message's channel ID changing
watch(() => props.messages[0]?.channelId, (newChannelId, oldChannelId) => {
  if (newChannelId && oldChannelId && newChannelId !== oldChannelId) {
    hasInitiallyScrolled.value = false
    previousScrollHeight.value = 0
    currentChannelId.value = newChannelId
  } else if (newChannelId && !currentChannelId.value) {
    currentChannelId.value = newChannelId
  }
}, { flush: 'sync' })

watch(() => props.messages.length, (newLength, oldLength) => {
  if (newLength === 0 && oldLength > 0) {
    hasInitiallyScrolled.value = false
    previousScrollHeight.value = 0
    scrollAnchorDistance.value = 0
    return
  }

  nextTick(() => {
    if (!messagesContainer.value) return
    const container = messagesContainer.value

    // Initial load - scroll to bottom
    if (oldLength === 0 && newLength > 0) {
      scrollToBottomWhenReady()
      hasInitiallyScrolled.value = true
      return
    }

    if (newLength > oldLength && previousScrollHeight.value > 0) {
      const newScrollHeight = container.scrollHeight
      const heightDifference = newScrollHeight - previousScrollHeight.value

      container.scrollTop = container.scrollTop + heightDifference

      previousScrollHeight.value = 0
      scrollAnchorDistance.value = 0
      return
    }

    if (newLength > oldLength && oldLength > 0 && !props.loadingMore) {
      if (isNearBottom()) {
        scrollToBottomWhenReady()
      }
    }
  })
})

watch(() => props.loading, (isLoading, wasLoading) => {
  if (!isLoading && wasLoading && props.messages.length > 0) {
    scrollToBottomWhenReady()
    hasInitiallyScrolled.value = true
  }
})

watch(() => props.messages, async (newMessages) => {
  for (const message of newMessages) {
    if (message.imageUrl) {
      await loadImageUrl(message.imageUrl)
    }
  }
}, { immediate: true, deep: true })
</script>

<template>
  <div
    ref="messagesContainer"
    class="flex-1 overflow-y-auto p-6 scrollbar-hide"
  >
    <div
      v-if="loading"
      class="h-full"
      aria-busy="true"
      aria-live="polite"
    >
      <div class="space-y-4 animate-pulse" role="status">
        <div
          v-for="i in 8"
          :key="i"
          class="flex gap-4"
        >
          <div class="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700" />
          <div class="flex-1 space-y-2">
            <div class="flex items-baseline gap-2">
              <div class="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
              <div class="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
            <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-11/12" />
            <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-8/12" />
          </div>
        </div>
      </div>
      <span class="sr-only">Loading messages…</span>
    </div>

    <div v-else-if="error" class="flex items-center justify-center h-full">
      <div class="text-red-500">
        {{ error }}
      </div>
    </div>

    <template v-else>
      <!-- Virtual scrolling container -->
      <div
        :style="{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative'
        }"
      >
        <div
          v-for="virtualRow in virtualRows"
          :key="virtualRow.index"
          :data-index="virtualRow.index"
          :style="{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${virtualRow.start}px)`
          }"
        >
          <template v-if="getMessage(virtualRow.index)">
            <div
              :data-message-id="getMessage(virtualRow.index)!.id"
              class="flex gap-4 group relative p-2 -m-2 rounded-lg mb-4"
              :class="{ 'opacity-60': isOptimistic(getMessage(virtualRow.index)!) }"
            >
              <UAvatar
                :src="getLoadedAvatarUrl(getMessage(virtualRow.index)!.userId)"
                :alt="getMessage(virtualRow.index)!.username"
                size="md"
              />
              <div class="flex-1 min-w-0">
                <div class="flex items-baseline gap-2 mb-1">
                  <UPopover
                    v-if="getMessage(virtualRow.index)!.userId !== authStore.user?.userId?.toString()"
                    :popper="{ placement: 'right', offsetDistance: 8 }"
                  >
                    <button
                      class="font-semibold text-gray-900 dark:text-white hover:underline cursor-pointer"
                    >
                      {{ getMessage(virtualRow.index)!.username }}
                    </button>
                    <template #content>
                      <UserProfileCard :user="getUserPresence(getMessage(virtualRow.index)!)" />
                    </template>
                  </UPopover>
                  <span
                    v-else
                    class="font-semibold text-gray-900 dark:text-white"
                  >
                    {{ getMessage(virtualRow.index)!.username }}
                  </span>
                  <span class="text-xs text-gray-500 dark:text-gray-400">
                    {{ formatTime(getMessage(virtualRow.index)!.timestamp) }}
                  </span>
                  <span v-if="isOptimistic(getMessage(virtualRow.index)!)" class="text-xs text-gray-400 dark:text-gray-500 italic">
                    (sending...)
                  </span>
                  <span v-else-if="getMessage(virtualRow.index)!.edited" class="text-xs text-gray-400 dark:text-gray-500 italic">
                    (edited)
                  </span>
                </div>

                <MessageEditor
                  v-if="editingMessageId === getMessage(virtualRow.index)!.id"
                  :message-id="getMessage(virtualRow.index)!.id"
                  :initial-content="contentWithoutMedia(getMessage(virtualRow.index)!.content) || getMessage(virtualRow.index)!.content"
                  @save="saveEdit"
                  @cancel="cancelEdit"
                />

                <template v-else>
                  <div
                    v-if="getMessage(virtualRow.index)!.replyToMessageId"
                    class="mb-2 pl-3 border-l-2 border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-r p-2 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                    @click="scrollToMessage(getMessage(virtualRow.index)!.replyToMessageId!)"
                  >
                    <div class="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 mb-1">
                      <UIcon name="i-lucide-corner-down-right" class="w-3 h-3" />
                      <span class="font-semibold">{{ getMessage(virtualRow.index)!.replyToUsername }}</span>
                    </div>
                    <p class="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                      {{ getMessage(virtualRow.index)!.replyToContent }}
                    </p>
                  </div>

                  <p class="text-gray-700 dark:text-gray-300 wrap-break-word whitespace-pre-wrap max-w-full">
                    {{ contentWithoutMedia(getMessage(virtualRow.index)!.content) || getMessage(virtualRow.index)!.content }}
                  </p>
                </template>

                <NuxtImg
                  v-if="getMessage(virtualRow.index)!.imageUrl && getLoadedImageUrl(getMessage(virtualRow.index)!.imageUrl!)"
                  :src="getLoadedImageUrl(getMessage(virtualRow.index)!.imageUrl!)"
                  :alt="getMessage(virtualRow.index)!.imageFilename || 'Uploaded image'"
                  class="mt-2 rounded-lg max-w-md shadow-sm cursor-pointer hover:opacity-90 transition-opacity hover:ring-2 hover:ring-blue-500"
                  loading="lazy"
                  width="448"
                  height="auto"
                  @click="openImageModal(getLoadedImageUrl(getMessage(virtualRow.index)!.imageUrl!), getMessage(virtualRow.index)!.imageFilename || 'Uploaded image')"
                />

                <YouTubePlayer
                  v-if="firstYouTubeFrom(getMessage(virtualRow.index)!.content)"
                  :url="firstYouTubeFrom(getMessage(virtualRow.index)!.content) as string"
                />
                <NuxtImg
                  v-if="firstGifFrom(getMessage(virtualRow.index)!.content)"
                  :src="firstGifFrom(getMessage(virtualRow.index)!.content) as string"
                  alt="gif"
                  class="mt-2 rounded max-w-xs"
                  loading="lazy"
                  width="320"
                  height="auto"
                />

                <div class="flex items-center gap-2 mt-2 flex-wrap">
                  <button
                    v-for="reactionGroup in groupReactions(getMessage(virtualRow.index)!.reactions)"
                    :key="reactionGroup.emoji"
                    type="button"
                    class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm transition-colors"
                    :class="hasUserReacted(reactionGroup.userIds)
                      ? 'bg-blue-100 dark:bg-blue-900 border border-blue-300 dark:border-blue-700'
                      : 'bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'"
                    :title="reactionGroup.usernames.join(', ')"
                    :disabled="isOptimistic(getMessage(virtualRow.index)!)"
                    @click="handleReactionClick(getMessage(virtualRow.index)!.id, reactionGroup.emoji)"
                  >
                    <span>{{ reactionGroup.emoji }}</span>
                    <span class="text-xs font-medium">{{ reactionGroup.count }}</span>
                  </button>

                  <div v-if="!isOptimistic(getMessage(virtualRow.index)!)" class="relative">
                    <button
                      type="button"
                      class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors opacity-0 group-hover:opacity-100"
                      :class="{ 'opacity-100': activeEmojiPicker === getMessage(virtualRow.index)!.id }"
                      @click="(e) => toggleEmojiPicker(getMessage(virtualRow.index)!.id, e)"
                    >
                      <span class="text-lg">+</span>
                    </button>

                    <div
                      v-if="activeEmojiPicker === getMessage(virtualRow.index)!.id"
                      ref="emojiPickerRef"
                      class="absolute left-0 z-10"
                      :class="openEmojiUpwards ? 'bottom-full mb-2' : 'top-full mt-2'"
                    >
                      <EmojiPicker @select="(emoji: string) => handleEmojiSelect(getMessage(virtualRow.index)!.id, emoji)" />
                    </div>
                  </div>

                  <button
                    v-if="canEdit(getMessage(virtualRow.index)!) && editingMessageId !== getMessage(virtualRow.index)!.id && !isOptimistic(getMessage(virtualRow.index)!)"
                    type="button"
                    class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors opacity-0 group-hover:opacity-100"
                    title="Edit message"
                    @click="startEdit(getMessage(virtualRow.index)!)"
                  >
                    <UIcon name="i-lucide-pencil" class="text-gray-600 dark:text-gray-300" />
                  </button>

                  <button
                    v-if="!isOptimistic(getMessage(virtualRow.index)!)"
                    type="button"
                    class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors opacity-0 group-hover:opacity-100"
                    title="Reply to message"
                    @click="handleReplyClick(getMessage(virtualRow.index)!)"
                  >
                    <UIcon name="i-lucide-reply" class="text-gray-600 dark:text-gray-300" />
                  </button>

                  <button
                    v-if="canDelete(getMessage(virtualRow.index)!) && !isOptimistic(getMessage(virtualRow.index)!)"
                    type="button"
                    class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 hover:bg-red-200 dark:hover:bg-red-800 transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete message"
                    @click="handleDeleteMessage(getMessage(virtualRow.index)!)"
                  >
                    <UIcon name="i-lucide-trash-2" class="text-red-600 dark:text-red-300" />
                  </button>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </template>

    <div ref="bottomAnchor" class="h-0" />

    <Teleport to="body">
      <div
        v-if="expandedImage"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4 cursor-zoom-out"
        @click="closeImageModal"
      >
        <button
          aria-label="Close image"
          class="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors z-50"
          @click.stop="closeImageModal"
        >
          <UIcon name="i-lucide-x" class="text-4xl" />
        </button>
        <NuxtImg
          :src="expandedImage"
          :alt="expandedImageAlt || 'Expanded image'"
          class="max-w-full max-h-full object-contain rounded-lg shadow-2xl cursor-default"
          width="1920"
          height="auto"
          @click.stop
        />
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* Hide scrollbar for Chrome, Safari and Opera */
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

/* Hide scrollbar for IE, Edge and Firefox */
.scrollbar-hide {
  -ms-overflow-style: none;  /* IE and Edge */
  scrollbar-width: none;  /* Firefox */
}

/* Highlight animation for scrolled-to messages */
.highlight-message {
  animation: highlight-pulse 2s ease-in-out;
}

@keyframes highlight-pulse {
  0% {
    background-color: rgb(59 130 246 / 0.2);
    box-shadow: 0 0 0 0 rgb(59 130 246 / 0.4), inset 0 0 0 2px rgb(59 130 246 / 0.6);
  }
  50% {
    background-color: rgb(59 130 246 / 0.3);
    box-shadow: 0 0 20px 0 rgb(59 130 246 / 0.3), inset 0 0 0 2px rgb(59 130 246 / 0.8);
  }
  100% {
    background-color: transparent;
    box-shadow: 0 0 0 0 transparent, inset 0 0 0 0 transparent;
  }
}
</style>
