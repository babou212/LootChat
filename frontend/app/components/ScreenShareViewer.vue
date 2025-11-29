<script setup lang="ts">
import type { ScreenShareInfo } from '../../shared/types/chat'

interface Props {
  screenShare: ScreenShareInfo | null
  isMinimized?: boolean
}

interface Emits {
  (e: 'close' | 'toggle-minimize'): void
}

const props = withDefaults(defineProps<Props>(), {
  isMinimized: false
})

const emit = defineEmits<Emits>()

const videoRef = ref<HTMLVideoElement | null>(null)
const isFullscreen = ref(false)

// Watch for stream changes to update video element
watch(() => props.screenShare?.stream, (stream) => {
  if (videoRef.value && stream) {
    videoRef.value.srcObject = stream
    videoRef.value.play().catch(console.error)
  }
}, { immediate: true })

// Also watch when video ref becomes available
watch(videoRef, (video) => {
  if (video && props.screenShare?.stream) {
    video.srcObject = props.screenShare.stream
    video.play().catch(console.error)
  }
}, { immediate: true })

const toggleFullscreen = async () => {
  if (!videoRef.value) return

  try {
    if (!document.fullscreenElement) {
      await videoRef.value.requestFullscreen()
      isFullscreen.value = true
    } else {
      await document.exitFullscreen()
      isFullscreen.value = false
    }
  } catch (error) {
    console.error('Fullscreen error:', error)
  }
}

// Listen for fullscreen changes
onMounted(() => {
  document.addEventListener('fullscreenchange', () => {
    isFullscreen.value = !!document.fullscreenElement
  })
})

const handleClose = () => {
  emit('close')
}

const handleToggleMinimize = () => {
  emit('toggle-minimize')
}
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    leave-active-class="transition-all duration-200 ease-in"
    enter-from-class="opacity-0 translate-x-4"
    enter-to-class="opacity-100 translate-x-0"
    leave-from-class="opacity-100 translate-x-0"
    leave-to-class="opacity-0 translate-x-4"
  >
    <div
      v-if="screenShare"
      class="fixed z-50 transition-all duration-300 ease-in-out"
      :class="[
        isMinimized
          ? 'bottom-4 right-4 w-80 h-52 rounded-lg shadow-2xl'
          : 'top-0 right-0 w-[60%] h-full shadow-2xl'
      ]"
    >
      <!-- Main container -->
      <div
        class="relative w-full h-full bg-gray-900 flex flex-col overflow-hidden"
        :class="isMinimized ? 'rounded-lg' : 'rounded-l-lg'"
      >
        <!-- Header -->
        <div
          class="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700"
          :class="isMinimized ? 'py-1.5' : 'py-2'"
        >
          <div class="flex items-center gap-2 min-w-0">
            <div class="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <UIcon name="i-lucide-monitor" class="text-purple-400 shrink-0" />
            <span
              class="text-white font-medium truncate"
              :class="isMinimized ? 'text-xs' : 'text-sm'"
            >
              {{ screenShare.sharerUsername }}'s Screen
            </span>
          </div>

          <div class="flex items-center gap-1">
            <!-- Fullscreen button (only when not minimized) -->
            <UButton
              v-if="!isMinimized"
              color="neutral"
              variant="ghost"
              size="xs"
              :icon="isFullscreen ? 'i-lucide-minimize' : 'i-lucide-maximize'"
              class="text-gray-400 hover:text-white"
              @click="toggleFullscreen"
            />

            <!-- Minimize/Maximize button -->
            <UButton
              color="neutral"
              variant="ghost"
              size="xs"
              :icon="isMinimized ? 'i-lucide-maximize-2' : 'i-lucide-minimize-2'"
              class="text-gray-400 hover:text-white"
              @click="handleToggleMinimize"
            />

            <!-- Close button -->
            <UButton
              color="neutral"
              variant="ghost"
              size="xs"
              icon="i-lucide-x"
              class="text-gray-400 hover:text-red-400"
              @click="handleClose"
            />
          </div>
        </div>

        <!-- Video container -->
        <div class="flex-1 relative bg-black overflow-hidden">
          <video
            ref="videoRef"
            autoplay
            playsinline
            muted
            class="w-full h-full object-contain"
          />

          <!-- Loading overlay -->
          <div
            v-if="!screenShare.stream"
            class="absolute inset-0 flex items-center justify-center bg-gray-900/80"
          >
            <div class="text-center text-gray-400">
              <UIcon name="i-lucide-loader-2" class="text-4xl animate-spin mb-2" />
              <p class="text-sm">
                Connecting to stream...
              </p>
            </div>
          </div>

          <!-- Hover controls (only when not minimized) -->
          <div
            v-if="!isMinimized && screenShare.stream"
            class="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent opacity-0 hover:opacity-100 transition-opacity"
          >
            <div class="flex items-center justify-center gap-4">
              <UButton
                color="neutral"
                variant="soft"
                size="sm"
                :icon="isFullscreen ? 'i-lucide-minimize' : 'i-lucide-maximize'"
                @click="toggleFullscreen"
              >
                {{ isFullscreen ? 'Exit Fullscreen' : 'Fullscreen' }}
              </UButton>
              <UButton
                color="neutral"
                variant="soft"
                size="sm"
                icon="i-lucide-minimize-2"
                @click="handleToggleMinimize"
              >
                Minimize
              </UButton>
              <UButton
                color="error"
                variant="soft"
                size="sm"
                icon="i-lucide-x"
                @click="handleClose"
              >
                Close
              </UButton>
            </div>
          </div>
        </div>

        <!-- Minimized click-to-expand hint -->
        <div
          v-if="isMinimized"
          class="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/40 transition-colors cursor-pointer group"
          @click="handleToggleMinimize"
        >
          <UIcon
            name="i-lucide-maximize-2"
            class="text-white text-2xl opacity-0 group-hover:opacity-100 transition-opacity"
          />
        </div>
      </div>

      <!-- Resize handle (when not minimized) -->
      <div
        v-if="!isMinimized"
        class="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize bg-transparent hover:bg-purple-500/50 transition-colors"
      />
    </div>
  </Transition>
</template>
