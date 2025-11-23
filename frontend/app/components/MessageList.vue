<script setup lang="ts">
import type { Message, Reaction } from '../../shared/types/chat'
import YouTubePlayer from '~/components/YouTubePlayer.vue'
import EmojiPicker from '~/components/EmojiPicker.vue'
import MessageEditor from '~/components/MessageEditor.vue'
import type { ReactionResponse } from '~/api/messageApi'
import { useAuthStore } from '../../stores/auth'

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
const { getAvatarUrl } = useAvatarUrl()

const presignedUrlCache = ref<Map<string, { url: string, expiry: number }>>(new Map())
const avatarUrls = ref<Map<string | number, string>>(new Map())

const loadAvatarUrl = async (userId: string | number, avatarPath: string | undefined) => {
  if (avatarPath && !avatarUrls.value.has(userId)) {
    const url = await getAvatarUrl(avatarPath)
    if (url) {
      avatarUrls.value.set(userId, url)
    }
  }
}

const getLoadedAvatarUrl = (userId: string | number): string => {
  return avatarUrls.value.get(userId) || ''
}

// Check if message is optimistic (pending server confirmation)
const isOptimistic = (message: Message): boolean => {
  return message.id < 0
}

// Watch messages and load avatars
watch(() => props.messages, (newMessages) => {
  newMessages.forEach((message) => {
    if (message.avatar) {
      loadAvatarUrl(message.userId, message.avatar)
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
const lastScrollTop = ref(0)
const previousScrollHeight = ref(0)

const handleMessagesScroll = () => {
  if (activeEmojiPicker.value !== null) {
    closeEmojiPicker()
  }

  const container = messagesContainer.value
  if (!container) return

  const currentScrollTop = container.scrollTop
  const scrollingUp = currentScrollTop < lastScrollTop.value
  lastScrollTop.value = currentScrollTop

  if (scrollingUp && currentScrollTop < 100 && props.hasMore && !props.loadingMore && !isLoadingMore.value) {
    previousScrollHeight.value = container.scrollHeight
    isLoadingMore.value = true
    emit('load-more')

    setTimeout(() => {
      isLoadingMore.value = false
    }, 500)
  }
}

onMounted(() => {
  if (messagesContainer.value) {
    messagesContainer.value.addEventListener('scroll', handleMessagesScroll, { passive: true } as AddEventListenerOptions)
  }

  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  if (messagesContainer.value) {
    messagesContainer.value.removeEventListener('scroll', handleMessagesScroll)
  }

  window.removeEventListener('keydown', handleKeyDown)
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

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
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

const hasInitiallyScrolled = ref(false)

watch(() => props.messages.length, (newLength, oldLength) => {
  if (newLength === 0 && oldLength > 0) {
    hasInitiallyScrolled.value = false
    previousScrollHeight.value = 0
    return
  }

  nextTick(() => {
    if (!messagesContainer.value) return
    const container = messagesContainer.value

    if (oldLength === 0 && newLength > 0) {
      scrollToBottom()
      hasInitiallyScrolled.value = true
      return
    }

    if (props.loadingMore === false && newLength > oldLength && previousScrollHeight.value > 0) {
      const newScrollHeight = container.scrollHeight
      const heightDifference = newScrollHeight - previousScrollHeight.value
      container.scrollTop = container.scrollTop + heightDifference
      previousScrollHeight.value = 0
      return
    }

    if (newLength > oldLength && oldLength > 0 && !props.loadingMore) {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200
      if (isNearBottom) {
        scrollToBottom()
      }
    }
  })
})

watch(() => props.loading, (isLoading) => {
  if (!isLoading && props.messages.length > 0 && !hasInitiallyScrolled.value) {
    scrollToBottom()
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
    class="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide"
  >
    <div
      v-if="loadingMore"
      class="flex justify-center py-2"
    >
      <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
    </div>

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
      <div
        v-for="message in messages"
        :key="message.id"
        class="flex gap-4 group"
        :class="{ 'opacity-60': isOptimistic(message) }"
      >
        <UAvatar
          :src="getLoadedAvatarUrl(message.userId)"
          :alt="message.username"
          size="md"
        />
        <div class="flex-1">
          <div class="flex items-baseline gap-2 mb-1">
            <span class="font-semibold text-gray-900 dark:text-white">
              {{ message.username }}
            </span>
            <span class="text-xs text-gray-500 dark:text-gray-400">
              {{ formatTime(message.timestamp) }}
            </span>
            <span v-if="isOptimistic(message)" class="text-xs text-gray-400 dark:text-gray-500 italic">
              (sending...)
            </span>
            <span v-else-if="message.edited" class="text-xs text-gray-400 dark:text-gray-500 italic">
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

          <p v-else class="text-gray-700 dark:text-gray-300">
            {{ contentWithoutMedia(message.content) || message.content }}
          </p>

          <img
            v-if="message.imageUrl && getLoadedImageUrl(message.imageUrl)"
            :src="getLoadedImageUrl(message.imageUrl)"
            :alt="message.imageFilename || 'Uploaded image'"
            class="mt-2 rounded-lg max-w-md shadow-sm cursor-pointer hover:opacity-90 transition-opacity hover:ring-2 hover:ring-blue-500"
            loading="lazy"
            @click="openImageModal(getLoadedImageUrl(message.imageUrl), message.imageFilename || 'Uploaded image')"
          >

          <YouTubePlayer
            v-if="firstYouTubeFrom(message.content)"
            :url="firstYouTubeFrom(message.content) as string"
          />
          <img
            v-if="firstGifFrom(message.content)"
            :src="firstGifFrom(message.content) as string"
            alt="gif"
            class="mt-2 rounded max-w-xs"
            loading="lazy"
          >

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
              :disabled="isOptimistic(message)"
              @click="handleReactionClick(message.id, reactionGroup.emoji)"
            >
              <span>{{ reactionGroup.emoji }}</span>
              <span class="text-xs font-medium">{{ reactionGroup.count }}</span>
            </button>

            <div v-if="!isOptimistic(message)" class="relative">
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
              v-if="canEdit(message) && editingMessageId !== message.id && !isOptimistic(message)"
              type="button"
              class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors opacity-0 group-hover:opacity-100"
              title="Edit message"
              @click="startEdit(message)"
            >
              <UIcon name="i-lucide-pencil" class="text-gray-600 dark:text-gray-300" />
            </button>

            <button
              v-if="canDelete(message) && !isOptimistic(message)"
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

    <!-- Image Lightbox Modal -->
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
        <img
          :src="expandedImage"
          :alt="expandedImageAlt || 'Expanded image'"
          class="max-w-full max-h-full object-contain rounded-lg shadow-2xl cursor-default"
          @click.stop
        >
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
</style>
