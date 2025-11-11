<script setup lang="ts">
import type { Message, Reaction } from '../../shared/types/chat'
import YouTubePlayer from '~/components/YouTubePlayer.vue'
import EmojiPicker from '~/components/EmojiPicker.vue'
import { messageApi } from '~/utils/api'
import { useAuthStore } from '../../stores/auth'

interface Props {
  messages: Message[]
  loading: boolean
  error: string | null
}

const props = defineProps<Props>()
const authStore = useAuthStore()

const messagesContainer = ref<HTMLElement | null>(null)
const activeEmojiPicker = ref<number | null>(null)
const emojiPickerRef = ref<HTMLElement | null>(null)
const openEmojiUpwards = ref(false)
const emojiAnchorEl = ref<HTMLElement | null>(null)
const PICKER_HEIGHT_ESTIMATE = 320
const inFlightReactions = new Set<string>()

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

const handleMessagesScroll = () => {
  if (activeEmojiPicker.value !== null) {
    closeEmojiPicker()
  }
}

onMounted(() => {
  if (messagesContainer.value) {
    messagesContainer.value.addEventListener('scroll', handleMessagesScroll, { passive: true } as AddEventListenerOptions)
  }
})

onUnmounted(() => {
  if (messagesContainer.value) {
    messagesContainer.value.removeEventListener('scroll', handleMessagesScroll)
  }
})

const handleReactionClick = async (messageId: number, emoji: string) => {
  const token = authStore.token
  const currentUser = authStore.user
  if (!token || !currentUser) return

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
      await messageApi.removeReaction(messageId, emoji, token)
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
    const serverReaction = await messageApi.addReaction(messageId, emoji, token)
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

watch(() => props.messages.length, () => {
  scrollToBottom()
})

watch(() => props.loading, (isLoading) => {
  if (!isLoading && props.messages.length > 0) {
    scrollToBottom()
  }
})

onMounted(() => {
  if (props.messages.length > 0) {
    scrollToBottom()
  }
})
</script>

<template>
  <div
    ref="messagesContainer"
    class="flex-1 overflow-y-auto p-6 space-y-4"
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
      <div
        v-for="message in messages"
        :key="message.id"
        class="flex gap-4 group"
      >
        <UAvatar
          :src="message.avatar"
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
          </div>
          <p class="text-gray-700 dark:text-gray-300">
            {{ contentWithoutMedia(message.content) || message.content }}
          </p>
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
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
