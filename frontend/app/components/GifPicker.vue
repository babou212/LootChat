<script setup lang="ts">
interface TenorMedia {
  url: string
}
interface TenorResult {
  media_formats?: {
    tinygif?: TenorMedia
    gif?: TenorMedia
  }
}
interface TenorResponse {
  results?: TenorResult[]
}

const emit = defineEmits<{
  select: [gifUrl: string]
}>()

const gifSearchQuery = ref('')
const gifResults = ref<string[]>([])
const gifLoading = ref(false)
const gifError = ref<string | null>(null)
const hasInitiallyLoaded = ref(false)

const config = useRuntimeConfig()
const TENOR_KEY = computed(() => (config as { public?: { tenorApiKey?: string } }).public?.tenorApiKey ?? 'LIVDSRZULELA')

let searchTimeout: NodeJS.Timeout | null = null

const searchGifs = async (query: string, isTrending = false) => {
  if (!query?.trim() && !isTrending) {
    gifResults.value = []
    gifError.value = null
    return
  }
  gifLoading.value = true
  gifError.value = null
  try {
    const baseUrl = isTrending
      ? 'https://tenor.googleapis.com/v2/featured'
      : 'https://tenor.googleapis.com/v2/search'

    const params: Record<string, string | number> = {
      key: TENOR_KEY.value as string,
      limit: 32,
      media_filter: 'gif,tinygif'
    }

    if (!isTrending) {
      params.q = query
    }

    const res = await $fetch<TenorResponse>(baseUrl, { params })
    const urls = (res?.results || [])
      .map((r: TenorResult) => r?.media_formats?.tinygif?.url || r?.media_formats?.gif?.url)
      .filter((u): u is string => typeof u === 'string')
    gifResults.value = urls
  } catch (e) {
    console.error('GIF search failed', e)
    gifError.value = 'Failed to load GIFs'
  } finally {
    gifLoading.value = false
  }
}

const loadTrendingGifs = async () => {
  if (!hasInitiallyLoaded.value) {
    hasInitiallyLoaded.value = true
    await searchGifs('', true)
  }
}

const selectGif = (gifUrl: string) => {
  emit('select', gifUrl)
}

// Auto-search with debounce when user types
watch(gifSearchQuery, (newQuery) => {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }

  if (!newQuery?.trim()) {
    gifResults.value = []
    gifError.value = null
    return
  }

  searchTimeout = setTimeout(() => {
    searchGifs(newQuery)
  }, 500) // 500ms debounce
})

onMounted(() => {
  loadTrendingGifs()
})

defineExpose({
  reset: () => {
    gifResults.value = []
    gifSearchQuery.value = ''
    gifError.value = null
    hasInitiallyLoaded.value = false
    if (searchTimeout) {
      clearTimeout(searchTimeout)
    }
  }
})
</script>

<template>
  <div
    class="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow flex flex-col"
    style="width: 600px; height: 600px;"
  >
    <div class="p-4 pb-0">
      <UInput
        v-model="gifSearchQuery"
        placeholder="Search GIFs (type to search)"
        size="md"
        icon="i-lucide-search"
        class="w-full"
        :loading="gifLoading"
      />
    </div>
    <div v-if="gifError" class="text-red-500 text-sm p-4">
      {{ gifError }}
    </div>
    <div v-else class="p-4 flex-1 overflow-hidden">
      <div class="grid grid-cols-4 gap-3 h-full overflow-y-auto scrollbar-hide">
        <!-- Loading skeletons -->
        <template v-if="gifLoading">
          <div
            v-for="i in 32"
            :key="`skeleton-${i}`"
            class="w-full h-28 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
          />
        </template>
        <!-- Actual GIF results -->
        <button
          v-for="(url, i) in gifResults"
          v-else
          :key="i"
          type="button"
          class="relative group hover:opacity-80 transition-opacity"
          @click="selectGif(url)"
        >
          <img
            :src="url"
            alt="gif"
            class="w-full h-28 object-cover rounded"
            loading="lazy"
          >
        </button>
        <!-- Empty state -->
        <div
          v-if="!gifLoading && gifResults.length === 0 && gifSearchQuery"
          class="col-span-4 text-center text-gray-500 dark:text-gray-400 text-sm py-8"
        >
          No GIFs found
        </div>
        <div
          v-if="!gifLoading && gifResults.length === 0 && !gifSearchQuery"
          class="col-span-4 text-center text-gray-500 dark:text-gray-400 text-sm py-8"
        >
          Type to search for GIFs
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scrollbar-hide {
  -ms-overflow-style: none;  /* IE and Edge */
  scrollbar-width: none;  /* Firefox */
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;  /* Chrome, Safari and Opera */
}
</style>
