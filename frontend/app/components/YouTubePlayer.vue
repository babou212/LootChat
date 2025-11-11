<script setup lang="ts">
interface Props {
  url: string
}

const props = defineProps<Props>()

const extractVideoId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }

  return null
}

const videoId = computed(() => extractVideoId(props.url))
const embedUrl = computed(() =>
  videoId.value ? `https://www.youtube.com/embed/${videoId.value}` : null
)
</script>

<template>
  <div v-if="embedUrl" class="mt-2 rounded overflow-hidden bg-black max-w-lg">
    <div class="relative" style="padding-bottom: 56.25%;">
      <iframe
        :src="embedUrl"
        class="absolute inset-0 w-full h-full"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
      />
    </div>
  </div>
</template>
