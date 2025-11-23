<script setup lang="ts">
import type GifPicker from '~/components/GifPicker.vue'
import { useMessagesStore } from '../../stores/messages'

definePageMeta({
  middleware: 'auth',
  ssr: false
})

const { user } = useAuth()
const messagesStore = useMessagesStore()

const token = ref<string | null>(null)

const getAuthToken = async (): Promise<string | null> => {
  try {
    const response = await $fetch<{ token: string }>('/api/auth/token')
    token.value = response.token
    return response.token
  } catch {
    token.value = null
    return null
  }
}

const { connect, disconnect, getClient } = useWebSocket()
const { joinVoiceChannel, leaveVoiceChannel } = useWebRTC()
const channelsComposable = useChannels()
const channels = channelsComposable.channels
const selectedChannel = channelsComposable.selectedChannel
const fetchChannels = channelsComposable.fetchChannels
const markChannelAsRead = channelsComposable.markChannelAsRead
const incrementUnreadCount = channelsComposable.incrementUnreadCount

const usersComposable = useUsers()
const users = usersComposable.users
const fetchUsers = usersComposable.fetchUsers
const updateUserPresence = usersComposable.updateUserPresence
const addUser = usersComposable.addUser

const composerComposable = useMessageComposer()
const newMessage = composerComposable.newMessage
const selectedImage = composerComposable.selectedImage
const imagePreviewUrl = composerComposable.imagePreviewUrl
const fileInputRef = composerComposable.fileInputRef
const showEmojiPicker = composerComposable.showEmojiPicker
const showGifPicker = composerComposable.showGifPicker
const handleImageSelectRaw = composerComposable.handleImageSelect
const removeImage = composerComposable.removeImage
const addEmoji = composerComposable.addEmoji
const addGif = composerComposable.addGif
const resetComposer = composerComposable.reset
const cleanupComposer = composerComposable.cleanup

const handleImageSelect = (event: Event) => {
  try {
    handleImageSelectRaw(event)
    error.value = null
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to select image'
  }
}

const { sendMessage: sendMessageToServer } = useMessageSender()
const { subscribeToChannelUpdates, unsubscribeAll: unsubscribeChannel } = useChannelSubscriptions()
const { subscribeToGlobal, unsubscribeAll: unsubscribeGlobal } = useGlobalSubscriptions()

const messages = computed(() => {
  if (!selectedChannel.value) return []
  return messagesStore.getChannelMessages(selectedChannel.value.id)
})

const hasMoreMessages = computed(() => {
  if (!selectedChannel.value) return true
  return messagesStore.hasMoreMessages(selectedChannel.value.id)
})

const currentPage = computed(() => {
  if (!selectedChannel.value) return 0
  return messagesStore.getCurrentPage(selectedChannel.value.id)
})

const loadingMoreMessages = ref(false)
const loading = ref(true)
const error = ref<string | null>(null)

const stompClient = computed(() => getClient())
const gifPickerRef = ref<InstanceType<typeof GifPicker> | null>(null)
const pickerWrapperRef = ref<HTMLElement | null>(null)

useClickAway(
  pickerWrapperRef,
  () => {
    showEmojiPicker.value = false
    showGifPicker.value = false
  },
  { active: computed(() => showEmojiPicker.value || showGifPicker.value) }
)

const selectChannel = async (channel: typeof channels.value[0]) => {
  if (channel.channelType === 'VOICE') {
    return
  }

  selectedChannel.value = channel
  markChannelAsRead(channel.id)
  loadingMoreMessages.value = false

  if (channel.channelType === 'TEXT' || !channel.channelType) {
    await fetchMessages()

    if (token.value) {
      await subscribeToChannelUpdates(channel, token.value)
    }
  } else {
    unsubscribeChannel()
  }
}

const fetchMessages = async (append = false) => {
  try {
    if (!user.value) {
      return navigateTo('/login')
    }

    const channelId = selectedChannel.value?.id
    if (!channelId) {
      return
    }

    if (!append) {
      loading.value = true
    } else {
      loadingMoreMessages.value = true
    }

    const page = append ? currentPage.value + 1 : 0
    await messagesStore.fetchMessages(channelId, page)

    loading.value = false
    loadingMoreMessages.value = false
  } catch (err) {
    console.error('Failed to fetch messages:', err)
    error.value = 'Failed to load messages'
    loading.value = false
    loadingMoreMessages.value = false
  }
}

const loadMoreMessages = async () => {
  if (!hasMoreMessages.value || loadingMoreMessages.value) return
  await fetchMessages(true)
}

const removeMessageById = (id: number) => {
  if (selectedChannel.value) {
    messagesStore.removeMessage(selectedChannel.value.id, id)
  }
}

const sendMessage = async () => {
  if ((!newMessage.value.trim() && !selectedImage.value) || !user.value || !selectedChannel.value) return

  const channelId = selectedChannel.value.id
  const messageContent = newMessage.value.trim()
  const imageToSend = selectedImage.value

  try {
    error.value = null
    await sendMessageToServer(channelId, messageContent, imageToSend)
    resetComposer()
  } catch (err: unknown) {
    console.error('Failed to send message:', err)
    if (messageContent && !newMessage.value) {
      newMessage.value = messageContent
    }
    error.value = err instanceof Error ? err.message : 'Failed to send message. Please try again.'
  }
}

const isClient = ref(false)

const toast = useToast()

const handleJoinVoice = async (channelId: number) => {
  const client = getClient()
  if (!client) {
    toast.add({
      title: 'Connection Error',
      description: 'WebSocket connection not established. Please wait and try again.',
      color: 'error',
      icon: 'i-lucide-wifi-off'
    })
    return
  }

  if (!client.connected) {
    const waitForConnection = (timeoutMs = 5000, intervalMs = 100) => {
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

    const isConnected = await waitForConnection()
    if (!isConnected) {
      toast.add({
        title: 'Connection Timeout',
        description: 'WebSocket connection could not be established. Please refresh the page.',
        color: 'error',
        icon: 'i-lucide-wifi-off'
      })
      return
    }
  }

  try {
    await joinVoiceChannel(channelId, client)
    toast.add({
      title: 'Connected',
      description: 'You joined the voice channel',
      color: 'success',
      icon: 'i-lucide-mic'
    })
  } catch (err) {
    console.error('Failed to join voice channel:', err)
    const errorMessage = err instanceof Error ? err.message : 'Failed to join voice channel'
    toast.add({
      title: 'Voice Connection Failed',
      description: errorMessage,
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  }
}

const handleLeaveVoice = () => {
  leaveVoiceChannel()
  toast.add({
    title: 'Disconnected',
    description: 'You left the voice channel',
    color: 'neutral',
    icon: 'i-lucide-phone-off'
  })
}

onMounted(async () => {
  isClient.value = true

  await getAuthToken()
  await fetchChannels()
  await fetchUsers()

  if (token.value) {
    try {
      await connect(token.value)

      if (user.value && user.value.userId) {
        updateUserPresence(user.value.userId, 'online')
      }

      const selectedChannelId = computed(() => selectedChannel.value?.id ?? null)

      subscribeToGlobal(
        (channelId: number) => incrementUnreadCount(channelId),
        (update: { userId: number, username: string, status: 'online' | 'offline' }) => {
          updateUserPresence(update.userId, update.status)
          if (!users.value.some((u: typeof users.value[0]) => u.userId === update.userId)) {
            addUser(update.userId, update.username, update.status)
          }
        },
        selectedChannelId
      )
    } catch (err) {
      console.error('Failed to connect to WebSocket:', err)
    }
  }

  if (channels.value.length > 0) {
    await selectChannel(channels.value[0]!)
  }
})

onUnmounted(() => {
  unsubscribeChannel()
  unsubscribeGlobal()
  cleanupComposer()
  disconnect()
})

watch(channels, (newChannels) => {
  if (newChannels.length > 0 && !selectedChannel.value) {
    const firstTextChannel = newChannels.find((ch: typeof channels.value[0]) => !ch.channelType || ch.channelType === 'TEXT')
    if (firstTextChannel) {
      selectChannel(firstTextChannel)
    }
  }
})

watch(() => user.value?.avatar, (newAvatar) => {
  if (user.value && user.value.userId) {
    const userIndex = users.value.findIndex((u: typeof users.value[0]) => u.userId === user.value!.userId)
    if (userIndex !== -1) {
      users.value[userIndex]!.avatar = newAvatar
    }
  }
})

watch(showGifPicker, (open) => {
  if (!open && gifPickerRef.value) {
    gifPickerRef.value.reset()
  }
})

watch(users, () => {
  if (user.value && user.value.userId) {
    const currentUserIndex = users.value.findIndex((u: typeof users.value[0]) => u.userId === user.value!.userId)
    if (currentUserIndex !== -1 && users.value[currentUserIndex]!.status !== 'online') {
      users.value[currentUserIndex]!.status = 'online'
    }
  }
}, { deep: true })
</script>

<template>
  <ClientOnly>
    <div v-if="isClient" class="fixed inset-0 flex bg-gray-50 dark:bg-gray-900">
      <ChannelSidebar
        :channels="channels"
        :selected-channel="selectedChannel"
        :stomp-client="stompClient"
        @select-channel="selectChannel"
        @join-voice="handleJoinVoice"
        @leave-voice="handleLeaveVoice"
      />

      <div class="flex-1 flex flex-col min-w-0">
        <div class="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-6">
          <div class="flex items-center gap-2">
            <UIcon
              :name="selectedChannel?.channelType === 'VOICE' ? 'i-lucide-mic' : 'i-lucide-hash'"
              class="text-xl text-gray-600 dark:text-gray-400"
            />
            <h1 class="text-xl font-semibold text-gray-900 dark:text-white">
              {{ selectedChannel?.name || 'Select a channel' }}
            </h1>
          </div>
          <div class="ml-auto">
            <UserMenu />
          </div>
        </div>

        <template v-if="selectedChannel?.channelType === 'TEXT'">
          <MessageList
            :messages="messages"
            :loading="loading"
            :error="error"
            :has-more="hasMoreMessages"
            :loading-more="loadingMoreMessages"
            @message-deleted="removeMessageById"
            @load-more="loadMoreMessages"
          />

          <div
            class="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4"
          >
            <div
              v-if="imagePreviewUrl"
              class="mb-2 relative inline-block"
            >
              <img :src="imagePreviewUrl" alt="Preview" class="max-h-32 rounded">
              <button
                type="button"
                class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
                @click="removeImage"
              >
                ×
              </button>
            </div>

            <form class="flex items-center gap-2" @submit.prevent="sendMessage">
              <div ref="pickerWrapperRef" class="relative flex items-center gap-1">
                <input
                  ref="fileInputRef"
                  type="file"
                  accept="image/*"
                  class="hidden"
                  @change="handleImageSelect"
                >
                <UButton
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-image-plus"
                  aria-label="Upload image"
                  @click="fileInputRef?.click()"
                />
                <UButton
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-smile"
                  aria-label="Insert emoji"
                  @click="showEmojiPicker = !showEmojiPicker; showGifPicker = false"
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
                  @click="showGifPicker = !showGifPicker; showEmojiPicker = false"
                />
                <div
                  v-if="showGifPicker"
                  class="absolute bottom-full mb-2 left-0 z-20"
                >
                  <GifPicker ref="gifPickerRef" @select="addGif" />
                </div>
              </div>

              <UTextarea
                v-model="newMessage"
                placeholder="Type a message..."
                :rows="1"
                autoresize
                class="flex-1"
                @keydown.enter.exact.prevent="sendMessage"
              />

              <UButton
                type="submit"
                icon="i-lucide-send"
                color="primary"
                :disabled="!newMessage.trim() && !selectedImage"
              >
                Send
              </UButton>
            </form>
          </div>
        </template>

        <VoiceChannel
          v-else-if="selectedChannel?.channelType === 'VOICE'"
          :channel="selectedChannel"
          :stomp-client="stompClient"
        />
      </div>

      <UserPanel :users="users" />
    </div>
  </ClientOnly>
</template>
