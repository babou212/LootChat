<script setup lang="ts">
import type { Channel } from '../../shared/types/chat'

interface Props {
  channels: Channel[]
  selectedChannel: Channel | null
}

interface Emits {
  (e: 'selectChannel', channel: Channel): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

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
      <UButton
        v-for="channel in channels"
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
  </div>
</template>
