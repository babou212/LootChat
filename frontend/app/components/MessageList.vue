<script setup lang="ts">
import type { Message } from '../../shared/types/chat'

interface Props {
  messages: Message[]
  loading: boolean
  error: string | null
}

const props = defineProps<Props>()

const messagesContainer = ref<HTMLElement | null>(null)

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

// Helpers to detect and render GIF URLs embedded in message content
const gifRegex = /(https?:\/\/\S+?\.gif)(?=\s|$)/i
const firstGifFrom = (text: string): string | null => {
  const m = text.match(gifRegex)
  return m && m[1] ? m[1] as string : null
}
const contentWithoutGifs = (text: string): string => text.replace(new RegExp(gifRegex, 'gi'), '').trim()

// Scroll to bottom when messages change
watch(() => props.messages.length, () => {
  scrollToBottom()
})

// Scroll to bottom when loading completes
watch(() => props.loading, (isLoading) => {
  if (!isLoading && props.messages.length > 0) {
    scrollToBottom()
  }
})

// Scroll to bottom on mount if messages exist
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
        class="flex gap-4"
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
            {{ contentWithoutGifs(message.content) || message.content }}
          </p>
          <img
            v-if="firstGifFrom(message.content)"
            :src="firstGifFrom(message.content) as string"
            alt="gif"
            class="mt-2 rounded max-w-xs"
            loading="lazy"
          >
        </div>
      </div>
    </template>
  </div>
</template>
