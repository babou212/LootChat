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

const {
  participants,
  isMuted,
  isDeafened,
  currentChannelId,
  toggleMute,
  toggleDeafen
} = useWebRTC()

const isConnecting = ref(false)

const voiceChannels = computed(() =>
  props.channels.filter(channel => channel.channelType === 'VOICE')
)

const isInVoice = computed(() => currentChannelId.value !== null)

const connectedVoiceChannel = computed(() => {
  if (!currentChannelId.value) return null
  return props.channels.find(ch => ch.id === currentChannelId.value && ch.channelType === 'VOICE')
})

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
        class="ml-6 mt-1 space-y-1"
      >
        <div
          v-for="participant in participants"
          :key="participant.userId"
          class="flex items-center gap-2 px-2 py-1 rounded text-sm"
          :class="{
            'bg-green-50 dark:bg-green-900/20': participant.isSpeaking,
            'text-gray-700 dark:text-gray-300': !participant.isSpeaking
          }"
        >
          <UIcon
            :name="participant.isMuted ? 'i-lucide-mic-off' : 'i-lucide-mic'"
            class="text-xs"
            :class="{
              'text-red-500': participant.isMuted,
              'text-green-500': participant.isSpeaking && !participant.isMuted,
              'text-gray-400': !participant.isSpeaking && !participant.isMuted
            }"
          />
          <span class="truncate">{{ participant.username }}</span>
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
      <UButton
        color="error"
        size="sm"
        icon="i-lucide-phone-off"
        class="w-full mt-2"
        @click="handleLeaveVoice"
      >
        Disconnect
      </UButton>
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
