<script setup lang="ts">
/**
 * Screen Share Settings Panel for LiveKit voice channels.
 * Allows users to configure screen sharing options.
 */

// Screen share quality presets
const qualityPresets = [
  { value: 'low', label: 'Low (720p, 30fps)', width: 1280, height: 720, frameRate: 30 },
  { value: 'medium', label: 'Medium (720p, 60fps)', width: 1280, height: 720, frameRate: 60 },
  { value: 'high', label: 'High (1080p, 60fps)', width: 1920, height: 1080, frameRate: 60 },
  { value: 'ultra', label: 'Ultra (1440p, 60fps)', width: 2560, height: 1440, frameRate: 60 }
]

// Settings state
const selectedQuality = ref('medium')
const includeAudio = ref(true)
const showCursor = ref(true)

// Get the LiveKit store for screen share status
const { isScreenSharing, startScreenShare, stopScreenShare } = useLiveKit()

/**
 * Handle quality change
 */
const handleQualityChange = (quality: unknown) => {
  if (typeof quality === 'string') {
    selectedQuality.value = quality
    console.log('[ScreenShareSettings] Quality changed to:', quality)
  }
}

/**
 * Get the current quality settings - always returns a valid preset
 */
const getCurrentQualitySettings = (): typeof qualityPresets[number] => {
  const found = qualityPresets.find(p => p.value === selectedQuality.value)
  // Always return medium as fallback - qualityPresets[1] is guaranteed to exist
  return found ?? { value: 'medium', label: 'Medium (720p, 60fps)', width: 1280, height: 720, frameRate: 60 }
}

/**
 * Start screen share with current settings
 */
const handleStartScreenShare = async () => {
  try {
    const quality = getCurrentQualitySettings()
    await startScreenShare({
      resolution: {
        width: quality.width,
        height: quality.height,
        frameRate: quality.frameRate
      },
      audio: includeAudio.value
    })
  } catch (error) {
    console.error('[ScreenShareSettings] Error starting screen share:', error)
  }
}

/**
 * Stop screen share
 */
const handleStopScreenShare = async () => {
  try {
    await stopScreenShare()
  } catch (error) {
    console.error('[ScreenShareSettings] Error stopping screen share:', error)
  }
}
</script>

<template>
  <div class="space-y-4">
    <!-- Screen Share Status -->
    <div
      class="p-3 rounded-lg"
      :class="isScreenSharing ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-700'"
    >
      <div class="flex items-center gap-2">
        <UIcon
          :name="isScreenSharing ? 'i-lucide-monitor' : 'i-lucide-monitor-off'"
          :class="isScreenSharing ? 'text-green-600 dark:text-green-400' : 'text-gray-500'"
        />
        <span
          class="text-sm font-medium"
          :class="isScreenSharing ? 'text-green-700 dark:text-green-300' : 'text-gray-700 dark:text-gray-300'"
        >
          {{ isScreenSharing ? 'Screen sharing active' : 'Not sharing screen' }}
        </span>
      </div>
    </div>

    <!-- Quality Settings -->
    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        <UIcon name="i-lucide-settings-2" class="inline mr-1" />
        Quality Preset
      </label>
      <select
        v-model="selectedQuality"
        class="w-full px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        <option v-for="preset in qualityPresets" :key="preset.value" :value="preset.value">
          {{ preset.label }}
        </option>
      </select>
      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Higher quality uses more bandwidth
      </p>
    </div>

    <!-- Audio Toggle -->
    <div class="flex items-center justify-between">
      <div>
        <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
          <UIcon name="i-lucide-volume-2" class="inline mr-1" />
          Include System Audio
        </label>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          Share audio from your computer
        </p>
      </div>
      <UToggle v-model="includeAudio" />
    </div>

    <!-- Cursor Toggle -->
    <div class="flex items-center justify-between">
      <div>
        <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
          <UIcon name="i-lucide-mouse-pointer-2" class="inline mr-1" />
          Show Cursor
        </label>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          Display cursor in screen share
        </p>
      </div>
      <UToggle v-model="showCursor" />
    </div>

    <!-- Action Buttons -->
    <div class="pt-2 border-t border-gray-200 dark:border-gray-700">
      <UButton
        v-if="!isScreenSharing"
        color="primary"
        icon="i-lucide-monitor"
        class="w-full"
        @click="handleStartScreenShare"
      >
        Start Screen Share
      </UButton>
      <UButton
        v-else
        color="error"
        icon="i-lucide-monitor-off"
        class="w-full"
        @click="handleStopScreenShare"
      >
        Stop Screen Share
      </UButton>
    </div>

    <!-- Tips -->
    <div class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
      <div class="flex items-start gap-2">
        <UIcon name="i-lucide-info" class="text-blue-600 dark:text-blue-400 mt-0.5" />
        <div class="text-xs text-blue-700 dark:text-blue-300">
          <p class="font-medium mb-1">
            Tips:
          </p>
          <ul class="list-disc list-inside space-y-0.5">
            <li>You can share your entire screen or a specific window</li>
            <li>System audio sharing may not be available on all browsers</li>
            <li>Lower quality settings work better on slower connections</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>
