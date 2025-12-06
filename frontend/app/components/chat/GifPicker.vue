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
  next?: string
}

const emit = defineEmits<{
  select: [gifUrl: string]
}>()

const gifSearchQuery = ref('')
const gifResults = ref<string[]>([])
const gifLoading = ref(false)
const gifError = ref<string | null>(null)
const hasInitiallyLoaded = ref(false)
const nextPos = ref<string>('')
const isLoadingMore = ref(false)

const config = useRuntimeConfig()
const TENOR_KEY = computed(() => (config as { public?: { tenorApiKey?: string } }).public?.tenorApiKey ?? 'LIVDSRZULELA')

let searchTimeout: NodeJS.Timeout | null = null

const searchGifs = async (query: string, isTrending = false, loadMore = false) => {
  if (!query?.trim() && !isTrending) {
    gifResults.value = []
    gifError.value = null
    nextPos.value = ''
    return
  }

  if (loadMore) {
    isLoadingMore.value = true
  } else {
    gifLoading.value = true
    nextPos.value = ''
  }

  gifError.value = null

  try {
    const baseUrl = isTrending
      ? 'https://tenor.googleapis.com/v2/featured'
      : 'https://tenor.googleapis.com/v2/search'

    const params: Record<string, string | number> = {
      key: TENOR_KEY.value as string,
      limit: 40,
      media_filter: 'gif,tinygif',
      contentfilter: 'medium',
      ar_range: 'standard'
    }

    if (!isTrending) {
      params.q = query
    }

    if (loadMore && nextPos.value) {
      params.pos = nextPos.value
    }

    const res = await $fetch<TenorResponse>(baseUrl, { params })
    const urls = (res?.results || [])
      .map((r: TenorResult) => r?.media_formats?.tinygif?.url || r?.media_formats?.gif?.url)
      .filter((u): u is string => typeof u === 'string')

    if (loadMore) {
      gifResults.value = [...gifResults.value, ...urls]
    } else {
      gifResults.value = urls
    }

    nextPos.value = res?.next || ''
  } catch (e) {
    console.error('GIF search failed', e)
    gifError.value = 'Failed to load GIFs'
  } finally {
    gifLoading.value = false
    isLoadingMore.value = false
  }
}

const loadTrendingGifs = async () => {
  if (!hasInitiallyLoaded.value) {
    hasInitiallyLoaded.value = true
    await searchGifs('', true)
  }
}

const loadMoreGifs = async () => {
  if (isLoadingMore.value || !nextPos.value) return

  if (gifSearchQuery.value?.trim()) {
    await searchGifs(gifSearchQuery.value, false, true)
  } else {
    await searchGifs('', true, true)
  }
}

const selectGif = (gifUrl: string) => {
  emit('select', gifUrl)
}

const handleScroll = (event: Event) => {
  const target = event.target as HTMLElement
  const scrollPercentage = (target.scrollTop + target.clientHeight) / target.scrollHeight

  if (scrollPercentage > 0.8 && !isLoadingMore.value && nextPos.value) {
    loadMoreGifs()
  }
}

// Auto-search with debounce when user types
watch(gifSearchQuery, (newQuery) => {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }

  if (!newQuery?.trim()) {
    loadTrendingGifs()
    return
  }

  searchTimeout = setTimeout(() => {
    searchGifs(newQuery)
  }, 400)
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
    nextPos.value = ''
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
        :loading="gifLoading && gifResults.length === 0"
      />
    </div>
    <div v-if="gifError" class="text-red-500 text-sm p-4">
      {{ gifError }}
    </div>
    <div v-else class="p-4 flex-1 overflow-hidden">
      <div class="grid grid-cols-4 gap-3 h-full overflow-y-auto scrollbar-hide" @scroll="handleScroll">
        <!-- Loading skeletons -->
        <template v-if="gifLoading && gifResults.length === 0">
          <div
            v-for="i in 40"
            :key="`skeleton-${i}`"
            class="w-full h-28 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
          />
        </template>
        <!-- Actual GIF results -->
        <template v-else>
          <button
            v-for="(url, i) in gifResults"
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
        </template>
        <!-- Loading more indicator -->
        <template v-if="isLoadingMore">
          <div
            v-for="i in 8"
            :key="`loading-more-${i}`"
            class="w-full h-28 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
          />
        </template>
        <!-- End of results -->
        <div
          v-if="!gifLoading && !isLoadingMore && gifResults.length > 0 && !nextPos"
          class="col-span-4 text-center text-gray-500 dark:text-gray-400 text-xs py-4"
        >
          End of results
        </div>
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
