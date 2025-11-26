<script setup lang="ts">
import type { Channel } from '../../shared/types/chat'

interface Props {
  channels: Channel[]
  isCollapsed: boolean
}

interface Emits {
  (e: 'joinVoice', channelId: number): void
  (e: 'leaveVoice'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const { getAvatarUrl } = useAvatarUrl()

const { user } = useAuth()

const {
  participants,
  isMuted,
  isDeafened,
  currentChannelId,
  toggleMute,
  toggleDeafen
} = useWebRTC()

const isConnecting = ref(false)
const avatarUrls = ref<Map<string, string>>(new Map())
const showAudioSettings = ref(false)

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

const loadAvatarUrl = async (userId: string, avatarPath: string | undefined) => {
  if (avatarPath && !avatarUrls.value.has(userId)) {
    const url = await getAvatarUrl(avatarPath)
    if (url) {
      avatarUrls.value.set(userId, url)
    }
  }
}

const getLoadedAvatarUrl = (userId: string): string => {
  return avatarUrls.value.get(userId) || ''
}

watch(() => participants.value, (newParticipants) => {
  newParticipants.forEach((participant) => {
    if (participant.avatar) {
      loadAvatarUrl(participant.userId, participant.avatar)
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
          class="group relative flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-all duration-150"
          :class="{
            'bg-green-50 dark:bg-green-900/30': participant.isSpeaking
          }"
        >
          <div class="relative shrink-0">
            <div
              class="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 overflow-hidden"
              :class="{
                'ring-2 ring-green-500 ring-offset-2 ring-offset-white dark:ring-offset-gray-800': participant.isSpeaking && !participant.isMuted,
                'ring-2 ring-gray-300 dark:ring-gray-600 ring-offset-2 ring-offset-white dark:ring-offset-gray-800': !participant.isSpeaking
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
          <div class="opacity-0 group-hover:opacity-100 transition-opacity">
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
          color="neutral"
          variant="soft"
          size="sm"
          icon="i-lucide-settings"
          class="flex-1"
          @click="showAudioSettings = !showAudioSettings"
        >
          Settings
        </UButton>
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

      <div
        v-if="showAudioSettings"
        class="mt-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg"
      >
        <div class="flex items-center justify-between mb-3">
          <h4 class="text-sm font-semibold text-gray-900 dark:text-white">
            🎙️ Audio Settings
          </h4>
          <button
            class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            @click="showAudioSettings = false"
          >
            <UIcon name="i-lucide-x" class="text-lg" />
          </button>
        </div>

        <AudioSettingsPanel @close="showAudioSettings = false" />
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
