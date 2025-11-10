<script setup lang="ts">
import type { Channel, Message } from '../../shared/types/chat'
import { messageApi, type MessageResponse } from '~/utils/api'

const router = useRouter()

const { token, user } = useAuth()

const channels = ref<Channel[]>([])

const selectedChannel = ref<Channel | null>(null)

const messages = ref<Message[]>([])

const newMessage = ref('')
const messagesContainer = ref<HTMLElement | null>(null)
const loading = ref(false)
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
    avatar: ''
  }
}

const fetchMessages = async () => {
  try {
    const authToken = localStorage.getItem('auth_token')
    if (!authToken) {
      router.push('/login')
      return
    }

    const apiMessages = await messageApi.getAllMessages(authToken)
    messages.value = apiMessages.map(convertToMessage)

    nextTick(() => {
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
      }
    })
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
        userId: user.value.id
      },
      token.value
    )

    // Add the new message to the list
    messages.value.push(convertToMessage(apiMessage))
    newMessage.value = ''

    nextTick(() => {
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
      }
    })
  } catch (err) {
    console.error('Failed to send message:', err)
    error.value = 'Failed to send message'
  }
}

const formatTime = (date: Date) => {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return date.toLocaleDateString()
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
        <UIcon name="i-lucide-hash" class="text-xl text-gray-600 dark:text-gray-400 mr-2" />
        <h1 class="text-xl font-semibold text-gray-900 dark:text-white">
          {{ selectedChannel?.name || 'Select a channel' }}
        </h1>
      </div>

      <div
        ref="messagesContainer"
        class="flex-1 overflow-y-auto p-6 space-y-4"
      >
        <div v-if="loading" class="flex items-center justify-center h-full">
          <div class="text-gray-500 dark:text-gray-400">
            Loading messages...
          </div>
        </div>

        <div v-else-if="error" class="flex items-center justify-center h-full">
          <div class="text-red-500">
            {{ error }}
          </div>
        </div>

        <div
          v-for="message in messages"
          :key="message.id"
          class="flex gap-4"
        >
          <UAvatar
            :src="message.avatar"
            :alt="message.username"
            size="md"
          />
          <div class="flex-1">
            <div class="flex items-baseline gap-2 mb-1">
              <span class="font-semibold text-gray-900 dark:text-white">
                {{ message.username }}
              </span>
              <span class="text-xs text-gray-500 dark:text-gray-400">
                {{ formatTime(message.timestamp) }}
              </span>
            </div>
            <p class="text-gray-700 dark:text-gray-300">
              {{ message.content }}
            </p>
          </div>
        </div>
      </div>

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
