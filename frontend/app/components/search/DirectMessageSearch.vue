<script setup lang="ts">
import { useDirectMessagesStore } from '../../../stores/directMessages'
import { useAvatarStore } from '../../../stores/avatars'
import { useDirectMessageSearch } from '../../composables/chat/useDirectMessageSearch'

interface DMSearchResult {
  messageId: number
  content: string
  userId: number
  username: string
  userAvatar?: string
  createdAt: string
  edited: boolean
  attachmentUrls?: string[]
}

const props = defineProps<{
  modelValue: boolean
  directMessageId: number | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'navigate-to-message': [messageId: number]
}>()

const directMessagesStore = useDirectMessagesStore()
const avatarStore = useAvatarStore()
const { searchMessages, loading } = useDirectMessageSearch()

const searchQuery = ref('')
const searchResults = ref<DMSearchResult[]>([])
const currentPage = ref(0)
const totalPages = ref(0)
const totalResults = ref(0)

const isOpen = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value)
})

const currentDM = computed(() => {
  if (!props.directMessageId) return null
  return directMessagesStore.getSelectedDirectMessage
})

async function performSearch(page: number = 0) {
  if (!searchQuery.value.trim() || !props.directMessageId) {
    searchResults.value = []
    return
  }

  const response = await searchMessages(
    props.directMessageId,
    searchQuery.value,
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

function navigateToMessage(result: DMSearchResult) {
  emit('navigate-to-message', result.messageId)
  isOpen.value = false
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

// Clear search when DM changes
watch(() => props.directMessageId, () => {
  searchQuery.value = ''
  searchResults.value = []
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
                placeholder="Search in this conversation..."
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

          <div v-if="currentDM && searchQuery && !loading" class="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {{ totalResults }} result{{ totalResults !== 1 ? 's' : '' }} with {{ currentDM.otherUsername }}
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
                  v-if="avatarStore.getAvatarUrl(result.userId)"
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
                  <div class="mt-1 text-sm text-gray-800 dark:text-gray-200">
                    <template v-for="(part, idx) in highlightQuery(result.content)" :key="idx">
                      <mark v-if="part.isMatch" class="bg-green-300 dark:bg-green-700 rounded px-0.5">{{ part.text }}</mark>
                      <span v-else>{{ part.text }}</span>
                    </template>
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
