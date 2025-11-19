<script setup lang="ts">
import type { Channel } from '../../shared/types/chat'
import type { Client } from '@stomp/stompjs'

interface Props {
  channel: Channel
  stompClient: Client | null
}

const props = defineProps<Props>()

const {
  participants,
  isMuted,
  isDeafened,
  currentChannelId,
  joinVoiceChannel,
  leaveVoiceChannel,
  toggleMute,
  toggleDeafen
} = useWebRTC()

const isConnected = computed(() => currentChannelId.value === props.channel.id)
const isConnecting = ref(false)
const error = ref<string | null>(null)

const handleJoinChannel = async () => {
  if (!props.stompClient) {
    error.value = 'WebSocket connection not established. Please wait a moment and try again.'
    console.error('STOMP client is null - WebSocket connection may not be ready')
    return
  }

  if (!props.stompClient.connected) {
    const waitForConnected = (client: Client, timeoutMs = 5000, intervalMs = 100) => {
      return new Promise<boolean>((resolve) => {
        const start = Date.now()
        const timer = setInterval(() => {
          if (client.connected) {
            clearInterval(timer)
            resolve(true)
          } else if (Date.now() - start > timeoutMs || !client.active) {
            clearInterval(timer)
            resolve(false)
          }
        }, intervalMs)
      })
    }

    isConnecting.value = true
    error.value = null

    const ok = await waitForConnected(props.stompClient)
    if (!ok) {
      error.value = 'WebSocket connection timeout. Please refresh the page and try again.'
      isConnecting.value = false
      return
    }
  }

  isConnecting.value = true
  error.value = null

  try {
    await joinVoiceChannel(props.channel.id, props.stompClient, props.channel.name)
  } catch (err) {
    console.error('Failed to join voice channel:', err)

    if (err instanceof Error) {
      error.value = err.message
    } else {
      error.value = 'Failed to join voice channel. Please check your microphone permissions.'
    }
  } finally {
    isConnecting.value = false
  }
}

const handleLeaveChannel = () => {
  leaveVoiceChannel()
  error.value = null
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
        v-if="!stompClient"
        color="warning"
        icon="i-lucide-wifi-off"
        title="Connecting to server..."
        class="mb-6"
      >
        <template #description>
          Please wait while we establish a connection. If this persists, try refreshing the page.
        </template>
      </UAlert>

      <div v-if="!isConnected" class="text-center">
        <div class="space-y-4">
          <p class="text-gray-600 dark:text-gray-400 mb-4">
            Join this voice channel to start talking with others
          </p>

          <UButton
            size="lg"
            color="primary"
            icon="i-lucide-phone-call"
            :loading="isConnecting"
            :disabled="isConnecting || !stompClient"
            @click="handleJoinChannel"
          >
            {{ isConnecting ? 'Connecting...' : 'Join Voice Channel' }}
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
              :key="participant.userId"
              class="flex items-center gap-3 p-3 rounded-lg transition-all duration-200"
              :class="{
                'bg-primary-50 dark:bg-primary-900/20 ring-2 ring-primary-500': participant.isSpeaking,
                'bg-gray-50 dark:bg-gray-700/50': !participant.isSpeaking
              }"
            >
              <div class="shrink-0 relative">
                <div
                  class="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center transition-all duration-200"
                  :class="{
                    'ring-4 ring-green-400 ring-opacity-75 scale-110': participant.isSpeaking
                  }"
                >
                  <span class="text-white font-semibold text-sm">
                    {{ participant.username.substring(0, 2).toUpperCase() }}
                  </span>
                </div>
                <div
                  v-if="participant.isSpeaking"
                  class="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-75"
                />
              </div>

              <div class="flex-1 min-w-0">
                <p
                  class="font-medium truncate transition-colors duration-200"
                  :class="{
                    'text-primary-700 dark:text-primary-300 font-semibold': participant.isSpeaking,
                    'text-gray-900 dark:text-white': !participant.isSpeaking
                  }"
                >
                  {{ participant.username }}
                  <span v-if="participant.isSpeaking" class="text-xs text-green-600 dark:text-green-400 ml-2">
                    Speaking
                  </span>
                </p>
              </div>

              <div class="shrink-0">
                <UIcon
                  v-if="participant.isMuted"
                  name="i-lucide-mic-off"
                  class="text-red-500 text-xl"
                />
                <UIcon
                  v-else
                  name="i-lucide-mic"
                  class="text-xl transition-colors duration-200"
                  :class="{
                    'text-green-500': participant.isSpeaking,
                    'text-gray-400': !participant.isSpeaking
                  }"
                />
              </div>
            </div>
          </div>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Voice Controls
          </h3>

          <div class="flex gap-4 justify-center">
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
              <UIcon name="i-lucide-info" class="inline" />
              You are muted
            </p>
            <p v-if="isDeafened" class="mt-1">
              <UIcon name="i-lucide-info" class="inline" />
              You are deafened
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
