<script setup lang="ts">
import type { Channel, Message } from '../../shared/types/chat'
import { messageApi, channelApi, type MessageResponse, type ChannelResponse } from '~/utils/api'
import MessageList from '~/components/MessageList.vue'
import UserMenu from '~/components/UserMenu.vue'
import EmojiPicker from '~/components/EmojiPicker.vue'
import type GifPicker from '~/components/GifPicker.vue'

definePageMeta({ middleware: 'auth' })

const { token, user } = useAuth()

const channels = ref<Channel[]>([])

const selectedChannel = ref<Channel | null>(null)

const messages = ref<Message[]>([])

const newMessage = ref('')
const loading = ref(true)
const error = ref<string | null>(null)

// Emoji & GIF picker state
const showEmojiPicker = ref(false)
const showGifPicker = ref(false)
const gifPickerRef = ref<InstanceType<typeof GifPicker> | null>(null)

const addEmoji = (emoji: string) => {
  newMessage.value += (newMessage.value && !newMessage.value.endsWith(' ') ? ' ' : '') + emoji
  showEmojiPicker.value = false
}

const addGifToMessage = (gifUrl: string) => {
  const spacer = newMessage.value && !newMessage.value.endsWith(' ') ? ' ' : ''
  newMessage.value = `${newMessage.value}${spacer}${gifUrl}`.trim()
  showGifPicker.value = false
}

const selectChannel = async (channel: Channel) => {
  selectedChannel.value = channel
  channel.unread = 0
  await fetchMessages()
}

const convertToChannel = (apiChannel: ChannelResponse): Channel => {
  return {
    id: apiChannel.id,
    name: apiChannel.name,
    description: apiChannel.description,
    createdAt: apiChannel.createdAt,
    updatedAt: apiChannel.updatedAt,
    unread: 0
  }
}

const convertToMessage = (apiMessage: MessageResponse): Message => {
  return {
    id: apiMessage.id,
    userId: apiMessage.userId.toString(),
    username: apiMessage.username,
    content: apiMessage.content,
    timestamp: new Date(apiMessage.createdAt),
    avatar: apiMessage.avatar,
    channelId: apiMessage.channelId,
    channelName: apiMessage.channelName
  }
}

const fetchChannels = async () => {
  try {
    const authToken = useCookie<string | null>('auth_token')
    if (!authToken.value || !user.value) {
      return navigateTo('/login')
    }

    const apiChannels = await channelApi.getAllChannels(authToken.value)
    channels.value = apiChannels.map(convertToChannel)
  } catch (err) {
    console.error('Failed to fetch channels:', err)
    error.value = 'Failed to load channels'
  }
}

const fetchMessages = async () => {
  try {
    const authToken = useCookie<string | null>('auth_token')
    if (!authToken.value || !user.value) {
      return navigateTo('/login')
    }

    const channelId = selectedChannel.value?.id
    const apiMessages = await messageApi.getAllMessages(authToken.value, channelId)
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
  if (!newMessage.value.trim() || !token.value || !user.value || !selectedChannel.value) return

  try {
    const apiMessage = await messageApi.createMessage(
      {
        content: newMessage.value,
        userId: user.value.userId,
        channelId: selectedChannel.value.id
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
  await fetchChannels()
  if (channels.value.length > 0) {
    await selectChannel(channels.value[0]!)
  }
})

watch(channels, (newChannels) => {
  if (newChannels.length > 0 && !selectedChannel.value) {
    selectChannel(newChannels[0]!)
  }
}, { immediate: true })

// Reset GIF picker state when closed
watch(showGifPicker, (open) => {
  if (!open && gifPickerRef.value) {
    gifPickerRef.value.reset()
  }
})
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
        <form class="flex items-center gap-2" @submit.prevent="sendMessage">
          <div class="relative flex items-center gap-1">
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-smile"
              aria-label="Insert emoji"
              @click="showEmojiPicker = !showEmojiPicker"
            />
            <div
              v-if="showEmojiPicker"
              class="absolute bottom-full mb-2 left-0 z-20"
            >
              <EmojiPicker @select="addEmoji" />
            </div>

            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-image"
              aria-label="Insert GIF"
              @click="showGifPicker = !showGifPicker"
            />
            <div
              v-if="showGifPicker"
              class="absolute bottom-full mb-2 left-12 z-20"
            >
              <GifPicker ref="gifPickerRef" @select="addGifToMessage" />
            </div>
          </div>

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
