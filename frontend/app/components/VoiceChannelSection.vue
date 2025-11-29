<script setup lang="ts">
import type { Channel } from '../../shared/types/chat'
import { useAvatarStore } from '../../stores/avatars'

interface Props {
  channels: Channel[]
  isCollapsed: boolean
}

interface Emits {
  (e: 'joinVoice', channelId: number): void
  (e: 'leaveVoice'): void
  (e: 'viewScreenShare', sharerId: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const avatarStore = useAvatarStore()

const { user } = useAuth()

const {
  participants,
  isMuted,
  isDeafened,
  currentChannelId,
  toggleMute,
  toggleDeafen,
  // Screen sharing
  isScreenSharing,
  hasActiveScreenShare,
  activeScreenShares,
  toggleScreenShare
} = useWebRTC()

const isConnecting = ref(false)
const showAudioSettings = ref(false)
const settingsTab = ref<'audio' | 'screenshare'>('audio')

const voiceChannels = computed(() =>
  props.channels.filter(channel => channel.channelType === 'VOICE')
)

const isInVoice = computed(() => currentChannelId.value !== null)

const connectedVoiceChannel = computed(() => {
  if (!currentChannelId.value) return null
  return props.channels.find(ch => ch.id === currentChannelId.value && ch.channelType === 'VOICE')
})

const getParticipantInitials = (username: string) => {
  return username.substring(0, 2).toUpperCase()
}

const isCurrentUser = (userId: string) => {
  return user.value?.userId.toString() === userId
}

const getLoadedAvatarUrl = (userId: string | number): string => {
  return avatarStore.getAvatarUrl(Number(userId)) || ''
}

watch(() => participants.value, (newParticipants) => {
  newParticipants.forEach((participant) => {
    if (participant.avatar) {
      avatarStore.loadAvatar(Number(participant.userId), participant.avatar)
    }
  })
}, { immediate: true, deep: true })

const handleJoinVoice = async (channelId: number) => {
  if (isConnecting.value) return
  isConnecting.value = true
  try {
    emit('joinVoice', channelId)
  } finally {
    setTimeout(() => {
      isConnecting.value = false
    }, 1000)
  }
}

const handleLeaveVoice = () => {
  emit('leaveVoice')
}

const handleViewScreenShare = (userId: string) => {
  const share = activeScreenShares.value.find(s => s.sharerId === userId)
  if (share) {
    emit('viewScreenShare', userId)
  }
}

const isUserSharing = (userId: string) => {
  return activeScreenShares.value.some(s => s.sharerId === userId)
}
</script>

<template>
  <div v-if="voiceChannels.length > 0">
    <h3
      v-show="!isCollapsed"
      class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase px-2 mb-2"
    >
      Voice Channels
    </h3>
    <div
      v-for="channel in voiceChannels"
      :key="channel.id"
      class="mb-1"
    >
      <UButton
        :variant="currentChannelId === channel.id ? 'soft' : 'ghost'"
        color="primary"
        :title="isCollapsed ? channel.name : channel.description"
        class="w-full"
        :class="isCollapsed ? 'justify-center' : 'justify-between'"
        @click="currentChannelId === channel.id ? handleLeaveVoice() : handleJoinVoice(channel.id)"
      >
        <span class="flex items-center gap-2">
          <UIcon name="i-lucide-mic" class="text-lg" />
          <span v-show="!isCollapsed">{{ channel.name }}</span>
        </span>
        <UBadge
          v-if="!isCollapsed && participants.length > 0 && currentChannelId === channel.id"
          color="success"
          :label="participants.length.toString()"
          size="xs"
        />
      </UButton>
      <div
        v-if="!isCollapsed && currentChannelId === channel.id && participants.length > 0"
        class="ml-3 mt-1 space-y-0.5"
      >
        <div
          v-for="participant in participants"
          :key="participant.userId"
          class="group relative flex items-center gap-2.5 px-2 py-1.5 rounded transition-all duration-150"
          :class="{
            'bg-green-50 dark:bg-green-900/30': participant.isSpeaking,
            'hover:bg-gray-100 dark:hover:bg-gray-700/50': !isUserSharing(participant.userId),
            'hover:bg-purple-100 dark:hover:bg-purple-900/30 cursor-pointer': isUserSharing(participant.userId)
          }"
          @click="isUserSharing(participant.userId) ? handleViewScreenShare(participant.userId) : undefined"
        >
          <div class="relative shrink-0">
            <div
              class="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 overflow-hidden"
              :class="{
                'ring-2 ring-green-500 ring-offset-2 ring-offset-white dark:ring-offset-gray-800': participant.isSpeaking && !participant.isMuted,
                'ring-2 ring-purple-500 ring-offset-2 ring-offset-white dark:ring-offset-gray-800': isUserSharing(participant.userId) && !participant.isSpeaking,
                'ring-2 ring-gray-300 dark:ring-gray-600 ring-offset-2 ring-offset-white dark:ring-offset-gray-800': !participant.isSpeaking && !isUserSharing(participant.userId)
              }"
            >
              <UAvatar
                v-if="participant.avatar && getLoadedAvatarUrl(participant.userId)"
                :src="getLoadedAvatarUrl(participant.userId)"
                :alt="participant.username"
                size="xs"
              />
              <div
                v-else
                class="w-full h-full flex items-center justify-center text-xs font-semibold"
                :class="{
                  'bg-green-600 text-white': participant.isSpeaking && !participant.isMuted,
                  'bg-gray-400 dark:bg-gray-600 text-white': !participant.isSpeaking || participant.isMuted
                }"
              >
                {{ getParticipantInitials(participant.username) }}
              </div>
            </div>
            <div
              v-if="participant.isSpeaking && !participant.isMuted"
              class="absolute inset-0 rounded-full animate-ping bg-green-400 opacity-75"
            />
            <div
              v-if="participant.isMuted"
              class="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 border-2 border-white dark:border-gray-800 flex items-center justify-center"
            >
              <UIcon name="i-lucide-mic-off" class="text-white text-[10px]" />
            </div>
            <div
              v-else-if="participant.isScreenSharing"
              class="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-purple-500 border-2 border-white dark:border-gray-800 flex items-center justify-center"
            >
              <UIcon name="i-lucide-monitor" class="text-white text-[10px]" />
            </div>
          </div>
          <div class="flex-1 min-w-0 flex items-center gap-2">
            <span
              class="text-sm font-medium truncate transition-colors duration-150"
              :class="{
                'text-green-700 dark:text-green-400': participant.isSpeaking && !participant.isMuted,
                'text-gray-700 dark:text-gray-300': !participant.isSpeaking && !participant.isMuted,
                'text-gray-500 dark:text-gray-500': participant.isMuted
              }"
            >
              {{ participant.username }}
              <span v-if="isCurrentUser(participant.userId)" class="text-xs text-gray-500 dark:text-gray-400">(you)</span>
            </span>
            <div
              v-if="participant.isSpeaking && !participant.isMuted"
              class="flex items-center gap-0.5 h-3"
            >
              <div class="w-0.5 bg-green-500 rounded-full audio-bar" style="animation-delay: 0ms" />
              <div class="w-0.5 bg-green-500 rounded-full audio-bar" style="animation-delay: 150ms" />
              <div class="w-0.5 bg-green-500 rounded-full audio-bar" style="animation-delay: 300ms" />
            </div>
          </div>
          <div class="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
            <!-- Watch stream button for screen sharers -->
            <UButton
              v-if="isUserSharing(participant.userId)"
              color="primary"
              variant="soft"
              size="xs"
              icon="i-lucide-eye"
              class="p-1!"
              @click.stop="handleViewScreenShare(participant.userId)"
            />
            <UIcon
              :name="participant.isMuted ? 'i-lucide-mic-off' : participant.isSpeaking ? 'i-lucide-volume-2' : 'i-lucide-mic'"
              class="text-xs"
              :class="{
                'text-red-500': participant.isMuted,
                'text-green-500': participant.isSpeaking && !participant.isMuted,
                'text-gray-400': !participant.isSpeaking && !participant.isMuted
              }"
            />
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="!isCollapsed && isInVoice && connectedVoiceChannel"
      class="border-t border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-900 mt-2"
    >
      <div class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
        Voice Connected
      </div>
      <div class="flex items-center gap-2 mb-2 px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded">
        <UIcon name="i-lucide-mic" class="text-green-600 dark:text-green-400" />
        <span class="text-sm font-medium text-green-700 dark:text-green-300 truncate">
          {{ connectedVoiceChannel.name }}
        </span>
      </div>
      <div class="flex gap-2">
        <UButton
          :color="isMuted ? 'error' : 'neutral'"
          :variant="isMuted ? 'solid' : 'soft'"
          size="sm"
          :icon="isMuted ? 'i-lucide-mic-off' : 'i-lucide-mic'"
          class="flex-1"
          @click="toggleMute"
        >
          {{ isMuted ? 'Unmute' : 'Mute' }}
        </UButton>
        <UButton
          :color="isDeafened ? 'error' : 'neutral'"
          :variant="isDeafened ? 'solid' : 'soft'"
          size="sm"
          :icon="isDeafened ? 'i-lucide-volume-x' : 'i-lucide-volume-2'"
          class="flex-1"
          @click="toggleDeafen"
        >
          {{ isDeafened ? 'Undeafen' : 'Deafen' }}
        </UButton>
      </div>
      <div class="flex gap-2 mt-2">
        <UButton
          :color="isScreenSharing ? 'success' : 'neutral'"
          :variant="isScreenSharing ? 'solid' : 'soft'"
          size="sm"
          :icon="isScreenSharing ? 'i-lucide-monitor-off' : 'i-lucide-monitor'"
          class="flex-1"
          @click="toggleScreenShare"
        >
          {{ isScreenSharing ? 'Stop Share' : 'Share' }}
        </UButton>
        <UButton
          color="neutral"
          variant="soft"
          size="sm"
          icon="i-lucide-settings"
          class="flex-1"
          @click="showAudioSettings = !showAudioSettings"
        >
          Settings
        </UButton>
      </div>
      <div class="flex gap-2 mt-2">
        <UButton
          color="error"
          size="sm"
          icon="i-lucide-phone-off"
          class="flex-1"
          @click="handleLeaveVoice"
        >
          Leave
        </UButton>
      </div>

      <!-- Screen share indicator -->
      <div
        v-if="hasActiveScreenShare && activeScreenShares[0]?.sharerId"
        class="mt-2 p-2 bg-purple-100 dark:bg-purple-900/30 rounded flex items-center gap-2 cursor-pointer hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
        @click="handleViewScreenShare(activeScreenShares[0].sharerId)"
      >
        <UIcon name="i-lucide-monitor" class="text-purple-600 dark:text-purple-400" />
        <span class="text-xs text-purple-700 dark:text-purple-300 truncate flex-1">
          {{ activeScreenShares[0]?.sharerUsername || 'Someone' }} is sharing
        </span>
        <UButton
          color="primary"
          variant="soft"
          size="xs"
          icon="i-lucide-eye"
        >
          Watch
        </UButton>
      </div>

      <div
        v-if="showAudioSettings"
        class="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/50"
        @click.self="showAudioSettings = false"
      >
        <div
          class="w-full max-w-sm p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-xl max-h-[80vh] overflow-y-auto"
        >
          <div class="flex items-center justify-between mb-3">
            <h4 class="text-sm font-semibold text-gray-900 dark:text-white">
              ⚙️ Settings
            </h4>
            <button
              class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              @click="showAudioSettings = false"
            >
              <UIcon name="i-lucide-x" class="text-lg" />
            </button>
          </div>

          <!-- Settings Tabs -->
          <div class="flex gap-1 mb-3 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <button
              class="flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all"
              :class="settingsTab === 'audio'
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'"
              @click="settingsTab = 'audio'"
            >
              🎙️ Audio
            </button>
            <button
              class="flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all"
              :class="settingsTab === 'screenshare'
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'"
              @click="settingsTab = 'screenshare'"
            >
              🖥️ Screen Share
            </button>
          </div>

          <!-- Audio Settings Panel -->
          <AudioSettingsPanel v-if="settingsTab === 'audio'" @close="showAudioSettings = false" />

          <!-- Screen Share Settings Panel -->
          <ScreenShareSettingsPanel v-else-if="settingsTab === 'screenshare'" />
        </div>
      </div>
    </div>

    <div
      v-if="isCollapsed && isInVoice"
      class="border-t border-gray-200 dark:border-gray-700 p-2 bg-green-50 dark:bg-green-900/20 mt-2"
    >
      <UButton
        color="success"
        variant="soft"
        size="sm"
        icon="i-lucide-mic"
        class="w-full"
        @click="handleLeaveVoice"
      />
    </div>
  </div>
</template>

<style scoped>
.audio-bar {
  animation: audioBar 0.8s ease-in-out infinite;
}

@keyframes audioBar {
  0%, 100% {
    height: 0.25rem;
  }
  50% {
    height: 0.75rem;
  }
}
</style>
