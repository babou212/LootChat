<script setup lang="ts">
import type { Channel, Message } from '../../shared/types/chat'
import { messageApi, type MessageResponse } from '~/utils/api'
import MessageList from '~/components/MessageList.vue'
import UserMenu from '~/components/UserMenu.vue'

const { token, user } = useAuth()

const channels = ref<Channel[]>([])

const selectedChannel = ref<Channel | null>(null)

const messages = ref<Message[]>([])

const newMessage = ref('')
const loading = ref(true)
const error = ref<string | null>(null)

const selectChannel = (channel: Channel) => {
  selectedChannel.value = channel
  channel.unread = 0
}

const convertToMessage = (apiMessage: MessageResponse): Message => {
  return {
    id: apiMessage.id,
    userId: apiMessage.userId.toString(),
    username: apiMessage.username,
    content: apiMessage.content,
    timestamp: new Date(apiMessage.createdAt),
    avatar: apiMessage.avatar
  }
}

const fetchMessages = async () => {
  try {
    const authToken = useCookie<string | null>('auth_token')
    if (!authToken.value) {
      return navigateTo('/login')
    }

    const apiMessages = await messageApi.getAllMessages(authToken.value)
    messages.value = apiMessages.map(convertToMessage)
    loading.value = false
  } catch (err) {
    console.error('Failed to fetch messages:', err)
    error.value = 'Failed to load messages'
  } finally {
    loading.value = false
  }
}

const sendMessage = async () => {
  if (!newMessage.value.trim() || !token.value || !user.value) return

  try {
    const apiMessage = await messageApi.createMessage(
      {
        content: newMessage.value,
        userId: user.value.userId
      },
      token.value
    )

    messages.value.push(convertToMessage(apiMessage))
    newMessage.value = ''
  } catch (err) {
    console.error('Failed to send message:', err)
    error.value = 'Failed to send message'
  }
}

onMounted(async () => {
  await fetchMessages()
})

watch(channels, (newChannels) => {
  if (newChannels.length > 0 && !selectedChannel.value) {
    selectChannel(newChannels[0]!)
  }
}, { immediate: true })
</script>

<template>
  <div class="fixed inset-0 flex bg-gray-50 dark:bg-gray-900">
    <ChannelSidebar
      :channels="channels"
      :selected-channel="selectedChannel"
      @select-channel="selectChannel"
    />

    <div class="flex-1 flex flex-col min-w-0">
      <div class="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-6">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-hash" class="text-xl text-gray-600 dark:text-gray-400" />
          <h1 class="text-xl font-semibold text-gray-900 dark:text-white">
            {{ selectedChannel?.name || 'Select a channel' }}
          </h1>
        </div>
        <div class="ml-auto">
          <UserMenu />
        </div>
      </div>

      <MessageList :messages="messages" :loading="loading" :error="error" />

      <div class="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
        <form class="flex gap-2" @submit.prevent="sendMessage">
          <UInput
            v-model="newMessage"
            placeholder="Type a message..."
            size="lg"
            class="flex-1"
            :ui="{ base: 'w-full' }"
          />
          <UButton
            type="submit"
            size="lg"
            icon="i-lucide-send"
            :disabled="!newMessage.trim()"
          >
            Send
          </UButton>
        </form>
      </div>
    </div>
  </div>
</template>
