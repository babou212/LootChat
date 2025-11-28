<script setup lang="ts">
import type { DirectMessageMessage, DirectMessageReaction } from '../../shared/types/directMessage.d'
import YouTubePlayer from '~/components/YouTubePlayer.vue'
import EmojiPicker from '~/components/EmojiPicker.vue'
import MessageEditor from '~/components/MessageEditor.vue'
import { useAuthStore } from '../../stores/auth'
import { useAvatarStore } from '../../stores/avatars'
import { directMessageApi } from '../../app/api/directMessageApi'

interface Props {
  messages: DirectMessageMessage[]
  loading: boolean
  error: string | null
  hasMore?: boolean
  loadingMore?: boolean
}

const props = defineProps<Props>()
const authStore = useAuthStore()
const toast = useToast()
const avatarStore = useAvatarStore()

const imageUrls = ref<Map<string, string>>(new Map())
const activeEmojiPicker = ref<number | null>(null)
const emojiPickerRef = ref<HTMLElement | null>(null)
const messagesContainer = ref<HTMLElement | null>(null)
const bottomAnchor = ref<HTMLElement | null>(null)

// Simple native implementation - check if user is near bottom
const isNearBottom = () => {
  const container = messagesContainer.value
  if (!container) return false
  const threshold = 200
  return container.scrollHeight - container.scrollTop - container.clientHeight < threshold
}

const scrollToBottom = () => {
  const container = messagesContainer.value
  if (!container) return
  container.scrollTop = container.scrollHeight
}

const scrollToBottomWhenReady = async () => {
  const container = messagesContainer.value
  if (!container) return

  // Wait for images to load
  const images = container.querySelectorAll('img')
  const imagePromises = Array.from(images).map((img) => {
    if (img.complete) return Promise.resolve()
    return new Promise((resolve) => {
      img.onload = resolve
      img.onerror = resolve
      setTimeout(resolve, 500) // Max wait 500ms per image
    })
  })

  await Promise.all(imagePromises)

  // Small delay for final layout
  await new Promise(resolve => setTimeout(resolve, 50))

  scrollToBottom()
}

const editingMessageId = ref<number | null>(null)
const expandedImage = ref<string | null>(null)
const expandedImageAlt = ref<string | null>(null)
const inFlightReactions = new Set<string>()
const openEmojiUpwards = ref(false)
const PICKER_HEIGHT_ESTIMATE = 420

const isLoadingMore = ref(false)
const lastScrollTop = ref(0)
const previousScrollHeight = ref(0)
const scrollAnchorDistance = ref(0)

const emit = defineEmits<{
  (e: 'message-deleted', id: number): void
  (e: 'reply-to-message', message: DirectMessageMessage): void
  (e: 'load-more'): void
}>()

const getLoadedAvatarUrl = (userId: string | number): string => {
  return avatarStore.getAvatarUrl(Number(userId)) || ''
}

const getAuthenticatedImageUrl = async (imageUrl: string): Promise<string> => {
  if (!imageUrl) return ''
  const filename = imageUrl.split('/').pop()
  if (!filename) return ''

  try {
    const response = await $fetch<{ url: string }>(`/api/files/images/${filename}`)
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

watch(() => props.messages, (newMessages) => {
  newMessages.forEach((message) => {
    if (message.senderAvatar) {
      avatarStore.loadAvatar(Number(message.senderId), message.senderAvatar)
    }
    if (message.imageUrl) {
      loadImageUrl(message.imageUrl)
    }
  })
}, { immediate: true, deep: true })

const canDelete = (message: DirectMessageMessage) => {
  const current = authStore.user
  if (!current) return false
  return String(message.senderId) === String(current.userId)
}

const canEdit = (message: DirectMessageMessage) => {
  const current = authStore.user
  if (!current) return false
  return String(message.senderId) === String(current.userId)
}

const startEdit = (message: DirectMessageMessage) => {
  editingMessageId.value = message.id
  closeEmojiPicker()
}

const cancelEdit = () => {
  editingMessageId.value = null
}

const saveEdit = async (messageId: number, content: string) => {
  try {
    const response = await directMessageApi.updateMessage(messageId, content)

    const message = props.messages.find(m => m.id === messageId)
    if (message) {
      message.content = response.content
      message.edited = true
      message.updatedAt = new Date(response.updatedAt!)
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

const handleDeleteMessage = (message: DirectMessageMessage) => {
  const performDelete = async () => {
    try {
      await directMessageApi.deleteMessage(message.id)
      emit('message-deleted', message.id)
      toast.add({
        title: 'Message deleted',
        description: 'Message has been removed',
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
    (r: DirectMessageReaction) => r.emoji === emoji && r.userId === Number(currentUser.userId)
  )

  if (existingIndex !== -1) {
    const removed = message.reactions[existingIndex]!
    message.reactions.splice(existingIndex, 1)
    try {
      await directMessageApi.removeReaction(messageId, emoji)
    } catch (error) {
      console.error('Error removing reaction:', error)
      message.reactions.splice(existingIndex, 0, removed)
    } finally {
      inFlightReactions.delete(key)
    }
    return
  }

  const tempId = -Date.now()
  const tempReaction: DirectMessageReaction = {
    id: tempId,
    emoji,
    userId: Number(currentUser.userId),
    username: currentUser.username,
    createdAt: new Date(),
    messageId
  }
  message.reactions.push(tempReaction)

  try {
    const serverReaction = await directMessageApi.addReaction(messageId, emoji)
    const tempIdx = message.reactions.findIndex((r: DirectMessageReaction) => r.id === tempId)
    if (tempIdx !== -1) {
      message.reactions[tempIdx] = {
        id: serverReaction.id,
        emoji: serverReaction.emoji,
        userId: serverReaction.userId,
        username: serverReaction.username,
        createdAt: new Date(serverReaction.createdAt),
        messageId: serverReaction.messageId
      }
    }
  } catch (error) {
    console.error('Error adding reaction:', error)
    const idx = message.reactions.findIndex((r: DirectMessageReaction) => r.id === tempId)
    if (idx !== -1) message.reactions.splice(idx, 1)
  } finally {
    inFlightReactions.delete(key)
  }
}

const toggleEmojiPicker = (messageId: number, event?: MouseEvent) => {
  if (activeEmojiPicker.value === messageId) {
    activeEmojiPicker.value = null
    openEmojiUpwards.value = false
    return
  }
  activeEmojiPicker.value = messageId

  // Calculate position
  nextTick(() => {
    if (!event) return
    const button = event.currentTarget as HTMLElement
    if (!button) return

    const buttonRect = button.getBoundingClientRect()
    const viewportHeight = window.innerHeight

    const spaceBelow = viewportHeight - buttonRect.bottom
    const spaceAbove = buttonRect.top

    openEmojiUpwards.value = spaceBelow < PICKER_HEIGHT_ESTIMATE && spaceAbove > spaceBelow
  })
}

const closeEmojiPicker = () => {
  activeEmojiPicker.value = null
  openEmojiUpwards.value = false
}

useClickAway(emojiPickerRef, closeEmojiPicker)

const handleEmojiSelect = async (messageId: number, emoji: string) => {
  await handleReactionClick(messageId, emoji)
  closeEmojiPicker()
}

const handleReplyClick = (message: DirectMessageMessage) => {
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

const openImageModal = (imageUrl: string, altText: string) => {
  expandedImage.value = imageUrl
  expandedImageAlt.value = altText
}

const closeImageModal = () => {
  expandedImage.value = null
  expandedImageAlt.value = null
}

const groupReactions = (reactions: DirectMessageReaction[] = []) => {
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

const handleMessagesScroll = () => {
  if (activeEmojiPicker.value !== null) {
    closeEmojiPicker()
  }

  const container = messagesContainer.value
  if (!container) return

  const scrollTop = container.scrollTop
  const scrollHeight = container.scrollHeight
  const clientHeight = container.clientHeight

  const distanceFromTop = scrollTop

  // Trigger load when user scrolls near the top (within 800px) - load before user sees the top
  if (distanceFromTop < 800 && props.hasMore && !props.loadingMore && !isLoadingMore.value) {
    // Store the current scroll position relative to the bottom
    scrollAnchorDistance.value = scrollHeight - scrollTop - clientHeight
    previousScrollHeight.value = scrollHeight

    isLoadingMore.value = true
    emit('load-more')

    setTimeout(() => {
      isLoadingMore.value = false
    }, 500)
  }

  lastScrollTop.value = scrollTop
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

const isOptimistic = (message: DirectMessageMessage): boolean => {
  return message.id < 0
}

const hasInitiallyScrolled = ref(false)

// Watch for DM conversation switches by detecting when messages array reference changes
watch(() => props.messages, (newMessages, oldMessages) => {
  // If it's a different array reference (DM conversation switch), reset scroll state
  if (newMessages !== oldMessages && newMessages.length > 0) {
    hasInitiallyScrolled.value = false
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

    // Loading older messages (scrolling up) - maintain scroll position
    if (props.loadingMore === false && newLength > oldLength && previousScrollHeight.value > 0) {
      const newScrollHeight = container.scrollHeight
      const heightDifference = newScrollHeight - previousScrollHeight.value

      // Restore scroll position by adding the height difference
      container.scrollTop = heightDifference

      previousScrollHeight.value = 0
      scrollAnchorDistance.value = 0
      return
    }

    // New messages coming in - scroll if user was at bottom
    if (newLength > oldLength && oldLength > 0 && !props.loadingMore) {
      if (isNearBottom()) {
        scrollToBottomWhenReady()
      }
    }
  })
})

watch(() => props.loading, (isLoading, wasLoading) => {
  if (!isLoading && wasLoading && props.messages.length > 0) {
    // Always scroll to bottom when loading finishes
    scrollToBottomWhenReady()
    hasInitiallyScrolled.value = true
  }
})

onMounted(() => {
  if (messagesContainer.value) {
    messagesContainer.value.addEventListener('scroll', handleMessagesScroll, { passive: true } as AddEventListenerOptions)
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && expandedImage.value) {
      closeImageModal()
    }
  })
})

onUnmounted(() => {
  if (messagesContainer.value) {
    messagesContainer.value.removeEventListener('scroll', handleMessagesScroll)
  }
})
</script>

<template>
  <div
    ref="messagesContainer"
    class="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide"
  >
    <div
      v-if="loading"
      class="h-full"
    >
      <div class="space-y-4 animate-pulse">
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
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="error" class="flex items-center justify-center h-full">
      <div class="text-red-500">
        {{ error }}
      </div>
    </div>

    <template v-else>
      <div
        v-for="message in messages"
        :key="message.id"
        :data-message-id="message.id"
        class="flex gap-4 group relative p-2 -m-2 rounded-lg"
        :class="{ 'opacity-60': isOptimistic(message) }"
      >
        <UAvatar
          :src="getLoadedAvatarUrl(message.senderId)"
          :alt="message.senderUsername"
          size="md"
        />
        <div class="flex-1 min-w-0">
          <div class="flex items-baseline gap-2 mb-1">
            <span class="font-semibold text-gray-900 dark:text-white">
              {{ message.senderUsername }}
            </span>
            <span class="text-xs text-gray-500 dark:text-gray-400">
              {{ formatTime(message.timestamp) }}
            </span>
            <span v-if="message.edited" class="text-xs text-gray-400 dark:text-gray-500 italic">
              (edited)
            </span>
          </div>

          <MessageEditor
            v-if="editingMessageId === message.id"
            :message-id="message.id"
            :initial-content="contentWithoutMedia(message.content) || message.content"
            @save="saveEdit"
            @cancel="cancelEdit"
          />

          <template v-else>
            <div
              v-if="message.replyToMessageId"
              class="mb-2 pl-3 border-l-2 border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-r p-2 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
              @click="scrollToMessage(message.replyToMessageId)"
            >
              <div class="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 mb-1">
                <UIcon name="i-lucide-corner-down-right" class="w-3 h-3" />
                <span class="font-semibold">{{ message.replyToUsername }}</span>
              </div>
              <p class="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                {{ message.replyToContent }}
              </p>
            </div>

            <p class="text-gray-700 dark:text-gray-300 wrap-break-word whitespace-pre-wrap max-w-full">
              {{ contentWithoutMedia(message.content) || message.content }}
            </p>
          </template>

          <NuxtImg
            v-if="message.imageUrl && getLoadedImageUrl(message.imageUrl)"
            :src="getLoadedImageUrl(message.imageUrl)"
            :alt="message.imageFilename || 'Uploaded image'"
            class="mt-2 rounded-lg max-w-md shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
            loading="lazy"
            width="448"
            height="auto"
            @click="openImageModal(getLoadedImageUrl(message.imageUrl), message.imageFilename || 'Uploaded image')"
          />

          <YouTubePlayer
            v-if="firstYouTubeFrom(message.content)"
            :url="firstYouTubeFrom(message.content) as string"
          />
          <NuxtImg
            v-if="firstGifFrom(message.content)"
            :src="firstGifFrom(message.content) as string"
            alt="gif"
            class="mt-2 rounded max-w-xs"
            loading="lazy"
            width="320"
            height="auto"
          />

          <div class="flex items-center gap-2 mt-2 flex-wrap">
            <button
              v-for="reactionGroup in groupReactions(message.reactions)"
              :key="reactionGroup.emoji"
              type="button"
              class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm transition-colors"
              :class="hasUserReacted(reactionGroup.userIds)
                ? 'bg-blue-100 dark:bg-blue-900 border border-blue-300 dark:border-blue-700'
                : 'bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'"
              :title="reactionGroup.usernames.join(', ')"
              @click="handleReactionClick(message.id, reactionGroup.emoji)"
            >
              <span>{{ reactionGroup.emoji }}</span>
              <span class="text-xs font-medium">{{ reactionGroup.count }}</span>
            </button>

            <div class="relative">
              <button
                type="button"
                class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors opacity-0 group-hover:opacity-100"
                :class="{ 'opacity-100': activeEmojiPicker === message.id }"
                @click="(e) => toggleEmojiPicker(message.id, e)"
              >
                <span class="text-lg">+</span>
              </button>

              <div
                v-if="activeEmojiPicker === message.id"
                ref="emojiPickerRef"
                class="absolute left-0 z-10"
                :class="openEmojiUpwards ? 'bottom-full mb-2' : 'top-full mt-2'"
              >
                <EmojiPicker @select="(emoji: string) => handleEmojiSelect(message.id, emoji)" />
              </div>
            </div>

            <button
              v-if="canEdit(message) && editingMessageId !== message.id"
              type="button"
              class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors opacity-0 group-hover:opacity-100"
              title="Edit message"
              @click="startEdit(message)"
            >
              <UIcon name="i-lucide-pencil" class="text-gray-600 dark:text-gray-300" />
            </button>

            <button
              type="button"
              class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors opacity-0 group-hover:opacity-100"
              title="Reply to message"
              @click="handleReplyClick(message)"
            >
              <UIcon name="i-lucide-reply" class="text-gray-600 dark:text-gray-300" />
            </button>

            <button
              v-if="canDelete(message)"
              type="button"
              class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 hover:bg-red-200 dark:hover:bg-red-800 transition-colors opacity-0 group-hover:opacity-100"
              title="Delete message"
              @click="handleDeleteMessage(message)"
            >
              <UIcon name="i-lucide-trash-2" class="text-red-600 dark:text-red-300" />
            </button>
          </div>
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
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.highlight-message {
  animation: highlight-pulse 2s ease-in-out;
}

@keyframes highlight-pulse {
  0% {
    background-color: rgb(59 130 246 / 0.2);
  }
  50% {
    background-color: rgb(59 130 246 / 0.3);
  }
  100% {
    background-color: transparent;
  }
}
</style>
