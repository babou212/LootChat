<script setup lang="ts">
import type { MessageSearchResult } from '../../../shared/types/search'
import type { Channel } from '../../../shared/types/chat'
import { useChannelsStore } from '../../../stores/channels'
import { useAvatarStore } from '../../../stores/avatars'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const channelsStore = useChannelsStore()
const avatarStore = useAvatarStore()
const { searchMessages, loading } = useMessageSearch()

const searchQuery = ref('')
const selectedChannelId = ref<number | undefined>(undefined)
const searchResults = ref<MessageSearchResult[]>([])
const currentPage = ref(0)
const totalPages = ref(0)
const totalResults = ref(0)

const isOpen = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value)
})

const channelOptions = computed(() => {
  return [
    { id: undefined, name: 'All Channels' },
    ...channelsStore.channels
      .filter((ch: Channel) => ch.channelType === 'TEXT')
      .map((ch: Channel) => ({ id: ch.id, name: ch.name }))
  ]
})

const selectedChannelName = computed(() => {
  if (!selectedChannelId.value) return 'All Channels'
  return channelsStore.channels
    .filter((ch: Channel) => ch.channelType === 'TEXT')
    .find((ch: Channel) => ch.id === selectedChannelId.value)?.name || 'All Channels'
})

async function performSearch(page: number = 0) {
  if (!searchQuery.value.trim()) {
    searchResults.value = []
    return
  }

  const response = await searchMessages(
    searchQuery.value,
    selectedChannelId.value,
    page,
    20
  )

  if (response) {
    searchResults.value = response.results || []
    currentPage.value = response.page
    totalPages.value = response.totalPages
    totalResults.value = response.totalElements
  } else {
    searchResults.value = []
  }
}

function handleSearchInput() {
  currentPage.value = 0
  performSearch(0)
}

function nextPage() {
  if (currentPage.value < totalPages.value - 1) {
    performSearch(currentPage.value + 1)
  }
}

function previousPage() {
  if (currentPage.value > 0) {
    performSearch(currentPage.value - 1)
  }
}

function selectChannel(channelId: number | undefined) {
  selectedChannelId.value = channelId
  if (searchQuery.value.trim()) {
    performSearch(0)
  }
}

function navigateToMessage(result: MessageSearchResult) {
  console.log('[MessageSearch] Navigating to channel', result.channelId, 'message', result.messageId)

  isOpen.value = false

  const router = useRouter()
  router.push({
    path: '/',
    query: {
      channel: result.channelId.toString(),
      highlight: result.messageId.toString()
    }
  })
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return `Today at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
  } else if (diffDays === 1) {
    return `Yesterday at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
  } else if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit' })
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
}

interface HighlightPart {
  text: string
  isMatch: boolean
}

function highlightQuery(content: string): HighlightPart[] {
  if (!searchQuery.value.trim()) {
    return [{ text: content, isMatch: false }]
  }

  const query = searchQuery.value.trim()
  const regex = new RegExp(`(${query})`, 'gi')
  const parts: HighlightPart[] = []
  let lastIndex = 0
  let match

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: content.slice(lastIndex, match.index), isMatch: false })
    }
    parts.push({ text: match[0], isMatch: true })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < content.length) {
    parts.push({ text: content.slice(lastIndex), isMatch: false })
  }

  return parts.length > 0 ? parts : [{ text: content, isMatch: false }]
}

onMounted(() => {
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen.value) {
      isOpen.value = false
    }
  }
  window.addEventListener('keydown', handleEscape)
  onUnmounted(() => window.removeEventListener('keydown', handleEscape))
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-20"
      @click.self="isOpen = false"
    >
      <div class="relative w-full max-w-3xl rounded-lg bg-white shadow-2xl dark:bg-gray-800">
        <div class="border-b border-gray-200 p-4 dark:border-gray-700">
          <div class="flex items-center gap-3">
            <div class="relative flex-1">
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Search messages..."
                class="w-full rounded-md border border-gray-300 bg-white px-4 py-2 pl-10 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                autofocus
                @input="handleSearchInput"
              >
              <svg
                class="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>

            <div class="relative">
              <select
                v-model="selectedChannelId"
                class="appearance-none rounded-md border border-gray-300 bg-white px-4 py-2 pr-10 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                @change="selectChannel(selectedChannelId)"
              >
                <option
                  v-for="channel in channelOptions"
                  :key="channel.id ?? 'all'"
                  :value="channel.id"
                >
                  {{ channel.name }}
                </option>
              </select>
              <svg
                class="pointer-events-none absolute right-3 top-3 h-4 w-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>

            <button
              class="rounded-md p-2 hover:bg-gray-100 dark:hover:bg-gray-700"
              @click="isOpen = false"
            >
              <svg
                class="h-5 w-5 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div v-if="searchQuery && !loading" class="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {{ totalResults }} result{{ totalResults !== 1 ? 's' : '' }} in {{ selectedChannelName }}
          </div>
        </div>

        <div class="h-96 max-h-96 overflow-y-auto">
          <div v-if="loading" class="space-y-3 p-4">
            <div v-for="i in 5" :key="i" class="flex items-start space-x-3 animate-pulse">
              <div class="h-10 w-10 rounded-full bg-gray-300 dark:bg-gray-600" />
              <div class="flex-1 space-y-2">
                <div class="h-4 w-24 rounded bg-gray-300 dark:bg-gray-600" />
                <div class="h-3 w-full rounded bg-gray-200 dark:bg-gray-700" />
                <div class="h-3 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
              </div>
            </div>
          </div>

          <div v-else-if="searchQuery && searchResults.length === 0" class="py-12 text-center text-gray-500 dark:text-gray-400">
            <svg
              class="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <p class="mt-2">
              No messages found
            </p>
          </div>

          <div v-else-if="searchResults.length > 0" class="divide-y divide-gray-200 dark:divide-gray-700">
            <button
              v-for="result in searchResults"
              :key="result.messageId"
              class="w-full px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
              @click="navigateToMessage(result)"
            >
              <div class="flex items-start gap-3">
                <img
                  v-if="result.userAvatar"
                  :src="avatarStore.getAvatarUrl(result.userId)"
                  :alt="result.username"
                  class="h-10 w-10 rounded-full"
                >
                <div
                  v-else
                  class="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 text-white font-semibold"
                >
                  {{ result.username.charAt(0).toUpperCase() }}
                </div>

                <div class="flex-1 min-w-0">
                  <div class="flex items-baseline gap-2">
                    <span class="font-semibold text-gray-900 dark:text-white">{{ result.username }}</span>
                    <span class="text-xs text-gray-500 dark:text-gray-400">{{ formatDate(result.createdAt) }}</span>
                    <span v-if="result.edited" class="text-xs text-gray-400 dark:text-gray-500">(edited)</span>
                  </div>
                  <div class="text-sm text-gray-600 dark:text-gray-300">
                    <span class="text-xs text-gray-500 dark:text-gray-400">#{{ result.channelName }}</span>
                  </div>
                  <div class="mt-1 text-sm text-gray-800 dark:text-gray-200">
                    <template v-for="(part, idx) in highlightQuery(result.content)" :key="idx">
                      <mark v-if="part.isMatch" class="bg-green-300 dark:bg-green-700 rounded px-0.5">{{ part.text }}</mark>
                      <span v-else>{{ part.text }}</span>
                    </template>
                  </div>

                  <div v-if="result.attachmentUrls && result.attachmentUrls.length > 0" class="mt-2">
                    <span class="text-xs text-gray-500 dark:text-gray-400">
                      📎 {{ result.attachmentUrls.length }} attachment{{ result.attachmentUrls.length !== 1 ? 's' : '' }}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          </div>

          <div v-else class="py-12 text-center text-gray-500 dark:text-gray-400">
            <svg
              class="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <p class="mt-2">
              Start typing to search messages
            </p>
          </div>
        </div>

        <div v-if="searchResults.length > 0 && totalPages > 1" class="border-t border-gray-200 p-4 dark:border-gray-700">
          <div class="flex items-center justify-between">
            <button
              :disabled="currentPage === 0"
              class="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
              @click="previousPage"
            >
              Previous
            </button>
            <span class="text-sm text-gray-600 dark:text-gray-400">
              Page {{ currentPage + 1 }} of {{ totalPages }}
            </span>
            <button
              :disabled="currentPage >= totalPages - 1"
              class="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
              @click="nextPage"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
