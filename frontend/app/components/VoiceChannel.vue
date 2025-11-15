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
  joinVoiceChannel,
  leaveVoiceChannel,
  toggleMute,
  toggleDeafen
} = useWebRTC()

const isConnected = ref(false)
const isConnecting = ref(false)
const error = ref<string | null>(null)
const permissionStatus = ref<'prompt' | 'granted' | 'denied'>('prompt')

const checkMicrophonePermission = async () => {
  try {
    if (!navigator.permissions || !navigator.permissions.query) {
      // Permissions API not supported, assume we need to request
      return
    }

    const result = await navigator.permissions.query({ name: 'microphone' as PermissionName })
    permissionStatus.value = result.state as 'prompt' | 'granted' | 'denied'

    result.onchange = () => {
      permissionStatus.value = result.state as 'prompt' | 'granted' | 'denied'
    }
  } catch (err) {
    console.warn('Could not check microphone permission:', err)
  }
}

onMounted(() => {
  checkMicrophonePermission()
})

const handleJoinChannel = async () => {
  if (!props.stompClient) {
    error.value = 'WebSocket not connected - client is null'
    return
  }

  if (!props.stompClient.connected) {
    const waitForConnected = (client: Client, timeoutMs = 3000, intervalMs = 100) => {
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

    const ok = await waitForConnected(props.stompClient)
    if (!ok) {
      error.value = 'WebSocket not connected - client not in connected state'
      return
    }
  }

  isConnecting.value = true
  error.value = null

  try {
    await joinVoiceChannel(props.channel.id, props.stompClient)
    isConnected.value = true
  } catch (err) {
    console.error('Failed to join voice channel:', err)
    error.value = 'Failed to join voice channel. Please check your microphone permissions.'
  } finally {
    isConnecting.value = false
  }
}

const handleLeaveChannel = () => {
  leaveVoiceChannel()
  isConnected.value = false
  error.value = null
}

onUnmounted(() => {
  if (isConnected.value) {
    handleLeaveChannel()
  }
})
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

      <div v-if="!isConnected" class="text-center">
        <UAlert
          v-if="permissionStatus === 'denied'"
          color="warning"
          icon="i-lucide-alert-triangle"
          title="Microphone Permission Denied"
          class="mb-6 text-left"
        >
          <template #description>
            <div class="space-y-2">
              <p>You have denied microphone access. To use voice chat:</p>
              <ol class="list-decimal list-inside space-y-1 text-sm">
                <li>Click the <strong>lock icon</strong> (🔒) or <strong>info icon</strong> (ⓘ) in your browser's address bar</li>
                <li>Find the <strong>Microphone</strong> setting</li>
                <li>Change it to <strong>Allow</strong></li>
                <li>Refresh the page and try again</li>
              </ol>
            </div>
          </template>
        </UAlert>

        <p class="text-gray-600 dark:text-gray-400 mb-2">
          Join this voice channel to start talking with others
        </p>
        <p v-if="permissionStatus === 'prompt'" class="text-sm text-gray-500 dark:text-gray-500 mb-4">
          You will be asked to allow microphone access
        </p>
        <UButton
          size="xl"
          color="primary"
          icon="i-lucide-phone-call"
          :loading="isConnecting"
          :disabled="isConnecting || permissionStatus === 'denied'"
          @click="handleJoinChannel"
        >
          {{ isConnecting ? 'Connecting...' : 'Join Voice Channel' }}
        </UButton>
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
              class="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50"
            >
              <div class="shrink-0">
                <div class="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center">
                  <span class="text-white font-semibold text-sm">
                    {{ participant.username.substring(0, 2).toUpperCase() }}
                  </span>
                </div>
              </div>

              <div class="flex-1 min-w-0">
                <p class="font-medium text-gray-900 dark:text-white truncate">
                  {{ participant.username }}
                </p>
              </div>

              <div class="shrink-0">
                <UIcon
                  v-if="participant.isMuted"
                  name="i-lucide-mic-off"
                  class="text-red-500"
                />
                <UIcon
                  v-else
                  name="i-lucide-mic"
                  class="text-green-500"
                  :class="{ 'animate-pulse': participant.isSpeaking }"
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
