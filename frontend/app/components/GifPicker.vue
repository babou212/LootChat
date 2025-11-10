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

const config = useRuntimeConfig()
const TENOR_KEY = computed(() => (config as { public?: { tenorApiKey?: string } }).public?.tenorApiKey ?? 'LIVDSRZULELA')

const searchGifs = async (query: string) => {
  if (!query?.trim()) {
    gifResults.value = []
    gifError.value = null
    return
  }
  gifLoading.value = true
  gifError.value = null
  try {
    const url = 'https://tenor.googleapis.com/v2/search'
    const params = {
      key: TENOR_KEY.value as string,
      q: query,
      limit: 24,
      media_filter: 'gif,tinygif'
    }
    const res = await $fetch<TenorResponse>(url, { params })
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

const selectGif = (gifUrl: string) => {
  emit('select', gifUrl)
}

defineExpose({
  reset: () => {
    gifResults.value = []
    gifSearchQuery.value = ''
    gifError.value = null
  }
})
</script>

<template>
  <div class="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow p-2 w-80">
    <div class="flex items-center gap-2 mb-2">
      <UInput
        v-model="gifSearchQuery"
        placeholder="Search GIFs"
        size="xs"
        :ui="{ base: 'w-full' }"
        @keydown.enter.prevent="searchGifs(gifSearchQuery)"
      />
      <UButton
        size="xs"
        icon="i-lucide-search"
        :loading="gifLoading"
        @click="searchGifs(gifSearchQuery)"
      >
        Search
      </UButton>
    </div>
    <div v-if="gifError" class="text-red-500 text-sm">
      {{ gifError }}
    </div>
    <div v-else class="grid grid-cols-3 gap-2 max-h-64 overflow-auto">
      <button
        v-for="(url, i) in gifResults"
        :key="i"
        type="button"
        class="relative group"
        @click="selectGif(url)"
      >
        <img
          :src="url"
          alt="gif"
          class="w-full h-24 object-cover rounded"
          loading="lazy"
        >
      </button>
    </div>
  </div>
</template>
