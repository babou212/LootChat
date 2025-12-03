<script setup lang="ts">
import type { Channel } from '../../../shared/types/chat'
import { useAvatarStore } from '../../../stores/avatars'

interface Props {
  channel: Channel
  wsConnected?: boolean
}

interface Emits {
  (e: 'viewScreenShare', odod: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const avatarStore = useAvatarStore()

const {
  participants,
  isMuted,
  isDeafened,
  currentChannelId,
  joinVoiceChannel,
  leaveVoiceChannel,
  toggleMute,
  toggleDeafen,
  isScreenSharing,
  activeScreenShares,
  hasActiveScreenShare,
  startScreenShare,
  stopScreenShare
} = useLiveKit()

const isConnected = computed(() => currentChannelId.value === props.channel.id)
const isConnecting = ref(false)
const error = ref<string | null>(null)

const showAudioSettings = ref(false)
const showScreenShareViewer = ref(false)
const selectedScreenShare = ref<string | null>(null)

const screenVideoRef = ref<HTMLVideoElement | null>(null)

const getLoadedAvatarUrl = (odod: string | number): string => {
  return avatarStore.getAvatarUrl(Number(odod)) || ''
}

watch(() => activeScreenShares.value, (shares) => {
  if (shares.length > 0 && screenVideoRef.value) {
    const activeShare = shares.find(s => s.odod === selectedScreenShare.value) || shares[0]
    if (activeShare?.track && screenVideoRef.value) {
      const track = activeShare.track as { attach?: (el: HTMLVideoElement) => void }
      if (track.attach) {
        track.attach(screenVideoRef.value)
      }
    }
  }
}, { immediate: true, deep: true })

watch(() => hasActiveScreenShare.value, (hasShare) => {
  if (hasShare && !selectedScreenShare.value) {
    selectedScreenShare.value = activeScreenShares.value[0]?.odod || null
    showScreenShareViewer.value = true
  } else if (!hasShare) {
    selectedScreenShare.value = null
    showScreenShareViewer.value = false
  }
}, { immediate: true })

watch(() => participants.value, (newParticipants) => {
  newParticipants.forEach((participant) => {
    if (participant.avatar) {
      avatarStore.loadAvatar(Number(participant.odod), participant.avatar)
    }
  })
}, { immediate: true, deep: true })

const handleJoinChannel = async () => {
  isConnecting.value = true
  error.value = null

  try {
    await joinVoiceChannel(props.channel.id, props.channel.name)
  } catch (err) {
    console.error('Failed to join voice channel:', err)
    error.value = err instanceof Error ? err.message : 'Failed to join voice channel.'
  } finally {
    isConnecting.value = false
  }
}

const handleLeaveChannel = () => {
  leaveVoiceChannel()
  error.value = null
}

const toggleScreenShare = async () => {
  if (isScreenSharing.value) {
    await stopScreenShare()
  } else {
    await startScreenShare()
  }
}

const openAudioSettings = () => {
  showAudioSettings.value = true
}

const isUserSharing = (odod: string) => {
  return activeScreenShares.value.some(s => s.odod === odod)
}

const handleViewScreenShare = (odod: string) => {
  if (isUserSharing(odod)) {
    emit('viewScreenShare', odod)
  }
}
</script>

<template>
  <div class="flex-1 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-8">
    <div class="max-w-2xl w-full">
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary-100 dark:bg-primary-900/30 mb-4">
          <UIcon name="i-lucide-mic" class="text-4xl text-primary-600 dark:text-primary-400" />
        </div>
        <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          {{ channel.name }}
        </h2>
        <p v-if="channel.description" class="text-gray-600 dark:text-gray-400">
          {{ channel.description }}
        </p>
      </div>

      <UAlert
        v-if="error"
        color="error"
        icon="i-lucide-alert-circle"
        :title="error"
        class="mb-6"
        @close="error = null"
      />

      <UAlert
        v-if="!wsConnected"
        color="warning"
        icon="i-lucide-wifi-off"
        title="Connecting to server..."
        class="mb-6"
      >
        <template #description>
          Please wait while we establish a connection.
        </template>
      </UAlert>

      <div v-if="!isConnected" class="text-center">
        <p class="text-gray-600 dark:text-gray-400 mb-4">
          Join this voice channel to start talking with others
        </p>
        <div class="flex flex-col items-center gap-3">
          <UButton
            size="lg"
            color="primary"
            icon="i-lucide-phone-call"
            :loading="isConnecting"
            :disabled="isConnecting"
            @click="handleJoinChannel"
          >
            {{ isConnecting ? 'Connecting...' : 'Join Voice Channel' }}
          </UButton>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-settings"
            @click="openAudioSettings"
          >
            Audio Settings
          </UButton>
        </div>
      </div>

      <div v-else class="space-y-6">
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Participants ({{ participants.length }})
          </h3>

          <div v-if="participants.length === 0" class="text-center text-gray-500 dark:text-gray-400 py-8">
            <UIcon name="i-lucide-users" class="text-4xl mb-2" />
            <p>No other participants yet</p>
          </div>

          <div v-else class="space-y-3">
            <div
              v-for="participant in participants"
              :key="participant.odod"
              class="flex items-center gap-3 p-3 rounded-lg transition-all duration-200"
              :class="{
                'bg-primary-50 dark:bg-primary-900/20 ring-2 ring-primary-500': participant.isSpeaking,
                'bg-gray-50 dark:bg-gray-700/50': !participant.isSpeaking,
                'cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-900/30': isUserSharing(participant.odod)
              }"
              @click="handleViewScreenShare(participant.odod)"
            >
              <div class="shrink-0 relative">
                <div
                  v-if="participant.avatar && getLoadedAvatarUrl(participant.odod)"
                  class="w-10 h-10 rounded-full overflow-hidden"
                  :class="{ 'ring-4 ring-green-400 ring-opacity-75 scale-110': participant.isSpeaking }"
                >
                  <img :src="getLoadedAvatarUrl(participant.odod)" :alt="participant.username" class="w-full h-full object-cover">
                </div>
                <div v-else class="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center" :class="{ 'ring-4 ring-green-400 ring-opacity-75 scale-110': participant.isSpeaking }">
                  <span class="text-white font-semibold text-sm">{{ participant.username.substring(0, 2).toUpperCase() }}</span>
                </div>
                <div v-if="participant.isSpeaking" class="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-75" />
              </div>

              <div class="flex-1 min-w-0">
                <p class="font-medium truncate" :class="{ 'text-primary-700 dark:text-primary-300 font-semibold': participant.isSpeaking, 'text-gray-900 dark:text-white': !participant.isSpeaking }">
                  {{ participant.username }}
                  <span v-if="participant.isSpeaking" class="text-xs text-green-600 dark:text-green-400 ml-2">Speaking</span>
                  <span v-if="participant.isScreenSharing" class="text-xs text-purple-600 dark:text-purple-400 ml-2">
                    <UIcon name="i-lucide-monitor" class="inline text-sm" /> Sharing
                  </span>
                </p>
              </div>

              <div class="shrink-0 flex items-center gap-2">
                <UButton
                  v-if="isUserSharing(participant.odod)"
                  color="primary"
                  variant="soft"
                  size="xs"
                  icon="i-lucide-eye"
                  @click.stop="handleViewScreenShare(participant.odod)"
                >
                  Watch
                </UButton>
                <UIcon v-if="participant.isScreenSharing" name="i-lucide-monitor" class="text-purple-500 text-xl" />
                <UIcon v-if="participant.isMuted" name="i-lucide-mic-off" class="text-red-500 text-xl" />
                <UIcon
                  v-else
                  name="i-lucide-mic"
                  class="text-xl"
                  :class="{ 'text-green-500': participant.isSpeaking, 'text-gray-400': !participant.isSpeaking }"
                />
              </div>
            </div>
          </div>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              Voice Controls
            </h3>
            <button class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600" @click="openAudioSettings">
              🎙️ Audio Settings
            </button>
          </div>

          <div class="flex gap-4 justify-center flex-wrap">
            <UButton
              :color="isMuted ? 'error' : 'primary'"
              :variant="isMuted ? 'solid' : 'soft'"
              size="xl"
              :icon="isMuted ? 'i-lucide-mic-off' : 'i-lucide-mic'"
              @click="toggleMute"
            >
              {{ isMuted ? 'Unmute' : 'Mute' }}
            </UButton>
            <UButton
              :color="isDeafened ? 'error' : 'primary'"
              :variant="isDeafened ? 'solid' : 'soft'"
              size="xl"
              :icon="isDeafened ? 'i-lucide-volume-x' : 'i-lucide-volume-2'"
              @click="toggleDeafen"
            >
              {{ isDeafened ? 'Undeafen' : 'Deafen' }}
            </UButton>
            <UButton
              :color="isScreenSharing ? 'success' : 'primary'"
              :variant="isScreenSharing ? 'solid' : 'soft'"
              size="xl"
              :icon="isScreenSharing ? 'i-lucide-monitor-off' : 'i-lucide-monitor'"
              @click="toggleScreenShare"
            >
              {{ isScreenSharing ? 'Stop Sharing' : 'Share Screen' }}
            </UButton>
            <UButton
              color="error"
              size="xl"
              icon="i-lucide-phone-off"
              @click="handleLeaveChannel"
            >
              Leave
            </UButton>
          </div>

          <div class="mt-4 text-sm text-gray-600 dark:text-gray-400 text-center">
            <p v-if="isMuted">
              <UIcon name="i-lucide-info" class="inline" /> You are muted
            </p>
            <p v-if="isDeafened" class="mt-1">
              <UIcon name="i-lucide-info" class="inline" /> You are deafened
            </p>
            <p v-if="isScreenSharing" class="mt-1 text-green-600 dark:text-green-400">
              <UIcon name="i-lucide-monitor" class="inline" /> You are sharing your screen
            </p>
          </div>
        </div>

        <div v-if="hasActiveScreenShare" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <UIcon name="i-lucide-monitor" class="text-green-500" /> Screen Share
              <span class="text-sm font-normal text-gray-500">({{ activeScreenShares.find(s => s.odod === selectedScreenShare)?.sharerUsername || 'Unknown' }})</span>
            </h3>
            <div class="flex items-center gap-2">
              <select v-if="activeScreenShares.length > 1" v-model="selectedScreenShare" class="px-3 py-1 rounded bg-gray-100 dark:bg-gray-700 text-sm">
                <option v-for="share in activeScreenShares" :key="share.odod" :value="share.odod">
                  {{ share.sharerUsername }}
                </option>
              </select>
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                :icon="showScreenShareViewer ? 'i-lucide-minimize-2' : 'i-lucide-maximize-2'"
                @click="showScreenShareViewer = !showScreenShareViewer"
              >
                {{ showScreenShareViewer ? 'Minimize' : 'Expand' }}
              </UButton>
            </div>
          </div>
          <div v-show="showScreenShareViewer" class="relative bg-black rounded-lg overflow-hidden" :style="{ aspectRatio: '16/9' }">
            <video
              ref="screenVideoRef"
              autoplay
              playsinline
              muted
              class="w-full h-full object-contain"
            />
            <div v-if="!activeScreenShares.find(s => s.odod === selectedScreenShare)?.track" class="absolute inset-0 flex items-center justify-center">
              <div class="text-center text-gray-400">
                <UIcon name="i-lucide-loader-2" class="text-4xl animate-spin mb-2" />
                <p>Connecting to screen share...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <UModal v-model="showAudioSettings">
      <div class="p-8 bg-white dark:bg-gray-800 rounded-lg">
        <h2 class="text-2xl font-bold mb-4">
          Audio Settings
        </h2>
        <AudioSettingsPanel @close="showAudioSettings = false" />
        <UButton class="mt-4" @click="showAudioSettings = false">
          Close
        </UButton>
      </div>
    </UModal>
  </div>
</template>
