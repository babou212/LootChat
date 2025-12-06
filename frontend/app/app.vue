<script setup lang="ts">
const colorMode = useColorMode()
const isLoading = ref(true)

const color = computed(() => colorMode.value === 'dark' ? '#1b1718' : 'white')

onMounted(() => {
  setTimeout(() => {
    isLoading.value = false
  }, 200)
})

useHead({
  meta: [
    { charset: 'utf-8' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { key: 'theme-color', name: 'theme-color', content: color }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' }
  ],
  htmlAttrs: {
    lang: 'en'
  }
})

const title = 'LootChat'
const description = 'A full-featured, chat application'

useSeoMeta({
  title,
  description
})
</script>

<template>
  <UApp :toaster="{ position: 'top-right' }">
    <Transition name="fade">
      <div
        v-if="isLoading"
        class="fixed inset-0 z-50 flex items-center justify-center bg-gray-50 dark:bg-gray-900"
      >
        <div class="flex flex-col items-center gap-6">
          <div class="relative">
            <div class="absolute inset-0 animate-ping rounded-full bg-green-500/20" />
            <div class="relative flex size-24 items-center justify-center rounded-full bg-green-500/10 ring-2 ring-green-500/30">
              <svg
                class="size-12 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
          </div>

          <div class="flex flex-col items-center gap-2">
            <h1 class="text-3xl font-bold text-white">
              LootChat
            </h1>
            <div class="flex items-center gap-2">
              <div class="size-2 animate-bounce rounded-full bg-green-500" style="animation-delay: 0ms" />
              <div class="size-2 animate-bounce rounded-full bg-green-500" style="animation-delay: 150ms" />
              <div class="size-2 animate-bounce rounded-full bg-green-500" style="animation-delay: 300ms" />
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
