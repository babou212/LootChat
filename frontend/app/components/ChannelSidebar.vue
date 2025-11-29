<script setup lang="ts">
import type { Channel } from '../../shared/types/chat'
import VoiceChannelSection from '~/components/VoiceChannelSection.vue'
import { useDirectMessagesStore } from '../../stores/directMessages'

interface Props {
  channels: Channel[]
  selectedChannel: Channel | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stompClient: any
}

interface Emits {
  (e: 'selectChannel', channel: Channel): void
  (e: 'joinVoice', channelId: number): void
  (e: 'leaveVoice'): void
  (e: 'viewScreenShare', sharerId: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const router = useRouter()
const directMessagesStore = useDirectMessagesStore()

const isCollapsed = ref(false)

const textChannels = computed(() =>
  props.channels.filter(channel => !channel.channelType || channel.channelType === 'TEXT')
)

const totalUnread = computed(() =>
  props.channels.reduce((sum, channel) => sum + (channel.unread || 0), 0)
)

const navigateToMessages = () => {
  router.push('/messages')
}

const handleSelectChannel = (channel: Channel) => {
  emit('selectChannel', channel)
}

const handleJoinVoice = (channelId: number) => {
  emit('joinVoice', channelId)
}

const handleLeaveVoice = () => {
  emit('leaveVoice')
}

const handleViewScreenShare = (sharerId: string) => {
  emit('viewScreenShare', sharerId)
}

const toggleSidebar = () => {
  isCollapsed.value = !isCollapsed.value
}

// Fetch DMs on mount to show unread count
onMounted(() => {
  directMessagesStore.fetchAllDirectMessages()
})
</script>

<template>
  <div
    :class="[
      'bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300',
      isCollapsed ? 'w-16' : 'w-64'
    ]"
  >
    <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
      <h2
        v-show="!isCollapsed"
        class="text-xl font-bold text-gray-900 dark:text-white"
      >
        Channels
      </h2>
      <div class="relative">
        <UButton
          :icon="isCollapsed ? 'i-lucide-panel-left-open' : 'i-lucide-panel-left-close'"
          :title="isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
          variant="ghost"
          color="neutral"
          size="sm"
          @click="toggleSidebar"
        />
        <UBadge
          v-if="isCollapsed && totalUnread > 0"
          color="error"
          :label="totalUnread > 99 ? '99+' : totalUnread.toString()"
          size="xs"
          class="absolute -top-1 -right-1"
        />
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-2">
      <div class="mb-4">
        <h3
          v-show="!isCollapsed"
          class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase px-2 mb-2"
        >
          Direct Messages
        </h3>
        <UButton
          variant="ghost"
          color="primary"
          :title="isCollapsed ? 'Direct Messages' : 'View all direct messages'"
          class="w-full mb-1"
          :class="isCollapsed ? 'justify-center' : 'justify-between'"
          @click="navigateToMessages"
        >
          <span class="flex items-center gap-2">
            <UIcon name="i-lucide-message-circle" class="text-lg" />
            <span v-show="!isCollapsed">Messages</span>
          </span>
          <UBadge
            v-if="directMessagesStore.getTotalUnreadCount > 0 && !isCollapsed"
            color="error"
            :label="directMessagesStore.getTotalUnreadCount.toString()"
            size="xs"
          />
        </UButton>
      </div>

      <div class="mb-4">
        <h3
          v-show="!isCollapsed"
          class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase px-2 mb-2"
        >
          Text Channels
        </h3>
        <UButton
          v-for="channel in textChannels"
          :key="channel.id"
          :variant="selectedChannel?.id === channel.id ? 'soft' : 'ghost'"
          color="primary"
          :title="isCollapsed ? channel.name : channel.description"
          class="w-full mb-1"
          :class="isCollapsed ? 'justify-center' : 'justify-between'"
          @click="handleSelectChannel(channel)"
        >
          <span class="flex items-center gap-2">
            <UIcon name="i-lucide-hash" class="text-lg" />
            <span v-show="!isCollapsed">{{ channel.name }}</span>
          </span>
          <UBadge
            v-if="channel.unread && !isCollapsed"
            color="error"
            :label="channel.unread.toString()"
            size="xs"
          />
        </UButton>
      </div>

      <VoiceChannelSection
        :channels="channels"
        :is-collapsed="isCollapsed"
        @join-voice="handleJoinVoice"
        @leave-voice="handleLeaveVoice"
        @view-screen-share="handleViewScreenShare"
      />
    </div>
  </div>
</template>
