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
const containerRef = ref<HTMLDivElement | null>(null)
const isFullscreen = ref(false)

const isDragging = ref(false)
const dragOffset = ref({ x: 0, y: 0 })
const position = ref({ x: 0, y: 0 })
const hasBeenDragged = ref(false)

const SNAP_MARGIN = 16
const CONTAINER_WIDTH = 320
const CONTAINER_HEIGHT = 192

const getSnapPositions = () => {
  const vw = window.innerWidth
  const vh = window.innerHeight

  return [
    { x: SNAP_MARGIN, y: SNAP_MARGIN, name: 'top-left' },
    { x: vw - CONTAINER_WIDTH - SNAP_MARGIN, y: SNAP_MARGIN, name: 'top-right' },
    { x: SNAP_MARGIN, y: vh - CONTAINER_HEIGHT - SNAP_MARGIN, name: 'bottom-left' },
    { x: vw - CONTAINER_WIDTH - SNAP_MARGIN, y: vh - CONTAINER_HEIGHT - SNAP_MARGIN, name: 'bottom-right' },

    { x: (vw - CONTAINER_WIDTH) / 2, y: SNAP_MARGIN, name: 'top-center' },
    { x: (vw - CONTAINER_WIDTH) / 2, y: vh - CONTAINER_HEIGHT - SNAP_MARGIN, name: 'bottom-center' },
    { x: SNAP_MARGIN, y: (vh - CONTAINER_HEIGHT) / 2, name: 'left-center' },
    { x: vw - CONTAINER_WIDTH - SNAP_MARGIN, y: (vh - CONTAINER_HEIGHT) / 2, name: 'right-center' }
  ]
}

// Find nearest snap position
const findNearestSnapPosition = (x: number, y: number) => {
  const snapPositions = getSnapPositions()
  let nearest = snapPositions[0]
  let minDistance = Infinity

  for (const pos of snapPositions) {
    const distance = Math.sqrt(Math.pow(x - pos.x, 2) + Math.pow(y - pos.y, 2))
    if (distance < minDistance) {
      minDistance = distance
      nearest = pos
    }
  }

  return nearest
}

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

const initializePosition = () => {
  position.value = {
    x: window.innerWidth - CONTAINER_WIDTH - SNAP_MARGIN,
    y: window.innerHeight - CONTAINER_HEIGHT - SNAP_MARGIN
  }
}

watch(() => props.isMinimized, (minimized) => {
  if (minimized) {
    initializePosition()
  }
  hasBeenDragged.value = false
})

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

const startDrag = (e: MouseEvent | TouchEvent) => {
  if (!props.isMinimized || !containerRef.value) return

  isDragging.value = true
  hasBeenDragged.value = true

  const clientX = 'touches' in e ? e.touches[0]?.clientX ?? 0 : e.clientX
  const clientY = 'touches' in e ? e.touches[0]?.clientY ?? 0 : e.clientY

  const rect = containerRef.value.getBoundingClientRect()
  dragOffset.value = {
    x: clientX - rect.left,
    y: clientY - rect.top
  }

  e.preventDefault()
}

const onDrag = (e: MouseEvent | TouchEvent) => {
  if (!isDragging.value || !containerRef.value) return

  const clientX = 'touches' in e ? e.touches[0]?.clientX ?? 0 : e.clientX
  const clientY = 'touches' in e ? e.touches[0]?.clientY ?? 0 : e.clientY

  const containerWidth = containerRef.value.offsetWidth
  const containerHeight = containerRef.value.offsetHeight

  let newX = clientX - dragOffset.value.x
  let newY = clientY - dragOffset.value.y

  const maxX = window.innerWidth - containerWidth
  const maxY = window.innerHeight - containerHeight

  newX = Math.max(0, Math.min(newX, maxX))
  newY = Math.max(0, Math.min(newY, maxY))

  position.value = { x: newX, y: newY }
}

const stopDrag = () => {
  if (isDragging.value && containerRef.value) {
    // Snap to nearest position
    const snapPos = findNearestSnapPosition(position.value.x, position.value.y)
    if (snapPos) {
      position.value = { x: snapPos.x, y: snapPos.y }
    }
  }
  isDragging.value = false
}

// Listen for fullscreen changes
onMounted(() => {
  document.addEventListener('fullscreenchange', () => {
    isFullscreen.value = !!document.fullscreenElement
  })

  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
  document.addEventListener('touchmove', onDrag, { passive: false })
  document.addEventListener('touchend', stopDrag)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
  document.removeEventListener('touchmove', onDrag)
  document.removeEventListener('touchend', stopDrag)
})

const handleClose = () => {
  emit('close')
}

const handleToggleMinimize = () => {
  emit('toggle-minimize')
}

const minimizedStyle = computed(() => {
  if (!props.isMinimized) return {}

  return {
    left: `${position.value.x}px`,
    top: `${position.value.y}px`,
    transition: isDragging.value ? 'none' : 'left 0.2s ease-out, top 0.2s ease-out'
  }
})
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
      ref="containerRef"
      class="fixed z-50 group"
      :class="[
        isMinimized
          ? 'w-80 h-48 rounded-lg shadow-2xl'
          : 'inset-0 left-16 md:left-64 transition-all duration-300 ease-in-out',
        isMinimized && isDragging ? 'cursor-grabbing' : '',
        isMinimized && !isDragging ? 'cursor-grab' : ''
      ]"
      :style="isMinimized ? minimizedStyle : {}"
      @mousedown="isMinimized ? startDrag($event) : null"
      @touchstart="isMinimized ? startDrag($event) : null"
      @dblclick="isMinimized ? handleToggleMinimize() : null"
    >
      <!-- Main container -->
      <div
        class="relative w-full h-full bg-gray-900 flex flex-col overflow-hidden"
        :class="isMinimized ? 'rounded-lg' : ''"
      >
        <!-- Header -->
        <div
          class="flex items-center justify-between px-4 bg-gray-800 border-b border-gray-700 select-none"
          :class="isMinimized ? 'py-1.5' : 'py-2'"
        >
          <div class="flex items-center gap-2 min-w-0">
            <UIcon
              v-if="isMinimized"
              name="i-lucide-grip-vertical"
              class="text-gray-500 shrink-0"
            />
            <div class="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <UIcon name="i-lucide-monitor" class="text-purple-400 shrink-0" />
            <span
              class="text-white font-medium truncate"
              :class="isMinimized ? 'text-xs' : 'text-sm'"
            >
              {{ screenShare.sharerUsername }}'s Screen
            </span>
          </div>

          <div class="flex items-center gap-1" @mousedown.stop @touchstart.stop>
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

          <div
            v-if="!isMinimized && screenShare.stream"
            class="absolute bottom-0 left-0 right-0 p-4 bg-linear-to-t from-black/80 to-transparent opacity-0 hover:opacity-100 transition-opacity"
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

        <!-- Minimized double-click hint (shows on hover) -->
        <div
          v-if="isMinimized"
          class="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <div class="bg-black/60 px-3 py-1.5 rounded-lg text-white text-xs select-none">
            Double-click to expand
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>
