<script setup lang="ts">
import type { Channel } from '../../shared/types/chat'

interface Props {
  channels: Channel[]
  selectedChannel: Channel | null
}

interface Emits {
  (e: 'selectChannel', channel: Channel): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const textChannels = computed(() =>
  props.channels.filter(channel => !channel.channelType || channel.channelType === 'TEXT')
)

const voiceChannels = computed(() =>
  props.channels.filter(channel => channel.channelType === 'VOICE')
)

const handleSelectChannel = (channel: Channel) => {
  emit('selectChannel', channel)
}
</script>

<template>
  <div class="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
    <div class="p-4 border-b border-gray-200 dark:border-gray-700">
      <h2 class="text-xl font-bold text-gray-900 dark:text-white">
        Channels
      </h2>
    </div>

    <div class="flex-1 overflow-y-auto p-2">
      <!-- Text Channels Section -->
      <div class="mb-4">
        <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase px-2 mb-2">
          Text Channels
        </h3>
        <UButton
          v-for="channel in textChannels"
          :key="channel.id"
          :variant="selectedChannel?.id === channel.id ? 'soft' : 'ghost'"
          color="primary"
          :title="channel.description"
          class="w-full justify-between mb-1"
          @click="handleSelectChannel(channel)"
        >
          <span class="flex items-center gap-2">
            <UIcon name="i-lucide-hash" class="text-lg" />
            {{ channel.name }}
          </span>
          <UBadge
            v-if="channel.unread"
            color="error"
            :label="channel.unread.toString()"
            size="xs"
          />
        </UButton>
      </div>

      <!-- Voice Channels Section -->
      <div v-if="voiceChannels.length > 0">
        <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase px-2 mb-2">
          Voice Channels
        </h3>
        <UButton
          v-for="channel in voiceChannels"
          :key="channel.id"
          :variant="selectedChannel?.id === channel.id ? 'soft' : 'ghost'"
          color="primary"
          :title="channel.description"
          class="w-full justify-between mb-1"
          @click="handleSelectChannel(channel)"
        >
          <span class="flex items-center gap-2">
            <UIcon name="i-lucide-mic" class="text-lg" />
            {{ channel.name }}
          </span>
        </UButton>
      </div>
    </div>
  </div>
</template>
