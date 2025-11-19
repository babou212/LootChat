<script setup lang="ts">
const {
  currentChannelId,
  currentChannelName,
  isMuted,
  isDeafened,
  leaveVoiceChannel,
  toggleMute,
  toggleDeafen
} = useWebRTC()

const isExpanded = ref(false)

const handleDisconnect = () => {
  leaveVoiceChannel()
  isExpanded.value = false
}
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-200 ease-out"
    enter-from-class="opacity-0 translate-y-2"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition-all duration-150 ease-in"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 translate-y-2"
  >
    <div
      v-if="currentChannelId"
      class="fixed bottom-4 left-4 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-200"
      :class="{ 'w-80': isExpanded, 'w-64': !isExpanded }"
    >
      <!-- Header -->
      <div
        class="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
        @click="isExpanded = !isExpanded"
      >
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <div class="relative">
            <div class="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
              <UIcon name="i-lucide-phone" class="text-white text-sm" />
            </div>
            <div class="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-75" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-xs text-green-700 dark:text-green-300 font-medium">
              Voice Connected
            </p>
            <p class="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {{ currentChannelName || 'Voice Channel' }}
            </p>
          </div>
        </div>
        <UIcon
          :name="isExpanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'"
          class="text-gray-500 dark:text-gray-400 shrink-0"
        />
      </div>

      <!-- Expanded Controls -->
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="max-h-0 opacity-0"
        enter-to-class="max-h-48 opacity-100"
        leave-active-class="transition-all duration-150 ease-in"
        leave-from-class="max-h-48 opacity-100"
        leave-to-class="max-h-0 opacity-0"
      >
        <div v-if="isExpanded" class="p-3 border-t border-gray-200 dark:border-gray-700">
          <div class="space-y-2">
            <!-- Mute Button -->
            <UButton
              block
              :color="isMuted ? 'error' : 'neutral'"
              :variant="isMuted ? 'solid' : 'soft'"
              :icon="isMuted ? 'i-lucide-mic-off' : 'i-lucide-mic'"
              @click="toggleMute"
            >
              {{ isMuted ? 'Unmute' : 'Mute' }}
            </UButton>

            <!-- Deafen Button -->
            <UButton
              block
              :color="isDeafened ? 'error' : 'neutral'"
              :variant="isDeafened ? 'solid' : 'soft'"
              :icon="isDeafened ? 'i-lucide-volume-x' : 'i-lucide-volume-2'"
              @click="toggleDeafen"
            >
              {{ isDeafened ? 'Undeafen' : 'Deafen' }}
            </UButton>

            <!-- Disconnect Button -->
            <UButton
              block
              color="error"
              icon="i-lucide-phone-off"
              @click="handleDisconnect"
            >
              Disconnect
            </UButton>
          </div>

          <div v-if="isMuted || isDeafened" class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div class="space-y-1 text-xs text-gray-600 dark:text-gray-400">
              <p v-if="isMuted" class="flex items-center gap-1">
                <UIcon name="i-lucide-mic-off" class="text-red-500" />
                You are muted
              </p>
              <p v-if="isDeafened" class="flex items-center gap-1">
                <UIcon name="i-lucide-volume-x" class="text-red-500" />
                You are deafened
              </p>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>
