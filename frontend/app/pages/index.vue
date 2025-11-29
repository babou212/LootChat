<script setup lang="ts">
import { z } from 'zod'
import type GifPicker from '~/components/GifPicker.vue'
import type { Message } from '../../shared/types/chat'
import type { DirectMessageMessage } from '../../shared/types/directMessage'
import { useMessagesStore } from '../../stores/messages'
import { useDirectMessagesStore } from '../../stores/directMessages'
import { useUserPresenceStore } from '../../stores/userPresence'
import { useChannelsStore } from '../../stores/channels'
import { useUsersStore } from '../../stores/users'
import { useComposerStore } from '../../stores/composer'
import { useWebSocketStore } from '../../stores/websocket'

const messageSchema = z.object({
  content: z.string()
    .min(1, 'Message cannot be empty')
    .max(50000, 'Message must be less than 50000 characters')
    .trim()
    .refine(val => val.length > 0, 'Message cannot be only whitespace')
})

definePageMeta({
  middleware: 'auth',
  ssr: false
})

const { user } = useAuth()
const messagesStore = useMessagesStore()
const directMessagesStore = useDirectMessagesStore()
const userPresenceStore = useUserPresenceStore()
const channelsStore = useChannelsStore()
const usersStore = useUsersStore()
const composerStore = useComposerStore()
const websocketStore = useWebSocketStore()

const { getClient, isConnected, subscribeToUserDirectMessages } = useWebSocket()
const { joinVoiceChannel, leaveVoiceChannel } = useWebRTC()
const { sendMessage: sendMessageToServer } = useMessageSender()
const { subscribeToChannelUpdates, unsubscribeAll: unsubscribeChannel } = useChannelSubscriptions()
const { subscribeToGlobal, unsubscribeAll: unsubscribeGlobal } = useGlobalSubscriptions()

// Keep usersComposable for full user data with email/role for UserPanel
const usersComposable = useUsers()
const usersWithFullData = usersComposable.users
const fetchUsers = usersComposable.fetchUsers
const updateUserPresence = usersComposable.updateUserPresence
const addUser = usersComposable.addUser

const channels = computed(() => channelsStore.channels)
const selectedChannel = computed({
  get: () => channelsStore.selectedChannel,
  set: value => channelsStore.selectChannel(value)
})
const users = computed(() => usersStore.users)

const fileInputRef = ref<HTMLInputElement | null>(null)

const messages = computed(() => {
  if (!selectedChannel.value) return []
  return messagesStore.getChannelMessages(selectedChannel.value.id)
})

const hasMoreMessages = computed(() => {
  if (!selectedChannel.value) return true
  return messagesStore.hasMoreMessages(selectedChannel.value.id)
})

const loadingMoreMessages = ref(false)
const loading = ref(true)
const error = ref<string | null>(null)
const validationError = ref<string | null>(null)

const stompClient = computed(() => getClient())
const gifPickerRef = ref<InstanceType<typeof GifPicker> | null>(null)
const pickerWrapperRef = ref<HTMLElement | null>(null)
let dmSubscription: ReturnType<typeof subscribeToUserDirectMessages> = null

// Composer helper functions
const handleImageSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) return

  if (!file.type.startsWith('image/')) {
    error.value = 'Please select an image file'
    return
  }

  if (file.size > 5 * 1024 * 1024) {
    error.value = 'Image size must be less than 5MB'
    return
  }

  composerStore.setImage(file)
  error.value = null
}

const removeImage = () => {
  composerStore.removeImage()
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

const addEmoji = (emoji: string) => {
  composerStore.addEmoji(emoji)
}

const addGif = (gifUrl: string) => {
  composerStore.addGif(gifUrl)
}

const setReplyingTo = (message: Message | DirectMessageMessage) => {
  composerStore.setReplyingTo(message)
}

const cancelReply = () => {
  composerStore.cancelReply()
}

const resetComposer = () => {
  composerStore.reset()
}

useClickAway(
  pickerWrapperRef,
  () => {
    composerStore.closePickers()
  },
  { active: computed(() => composerStore.isPickerOpen) }
)

const selectChannel = async (channel: typeof channels.value[0]) => {
  if (channel.channelType === 'VOICE') {
    return
  }

  channelsStore.selectChannel(channel)
  channelsStore.markChannelAsRead(channel.id)
  loadingMoreMessages.value = false

  if (channel.channelType === 'TEXT' || !channel.channelType) {
    await fetchMessages()

    const token = websocketStore.token
    if (token) {
      // Only wait for WebSocket connection if not already connected
      if (!isConnected.value) {
        console.log('Waiting for WebSocket connection...')
        let attempts = 0
        while (!isConnected.value && attempts < 20) {
          await new Promise(resolve => setTimeout(resolve, 250))
          attempts++
        }

        if (!isConnected.value) {
          console.error('WebSocket connection timeout - cannot subscribe to channel')
          return
        }
      }

      await subscribeToChannelUpdates(channel, token)
    }
  } else {
    unsubscribeChannel()
  }
}

const fetchMessages = async (loadOlder = false) => {
  try {
    if (!user.value) {
      return navigateTo('/login')
    }

    const channelId = selectedChannel.value?.id
    if (!channelId) {
      return
    }

    if (!loadOlder) {
      loading.value = true
    } else {
      loadingMoreMessages.value = true
    }

    // page=0 for initial load, page=1 signals "load older" (cursor-based)
    const page = loadOlder ? 1 : 0
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
    // Soft delete: mark as deleted instead of removing
    // This preserves reply chain context in the UI
    messagesStore.markAsDeleted(selectedChannel.value.id, id)
  }
}

const sendMessage = async () => {
  if (!composerStore.hasContent || !user.value || !selectedChannel.value) return

  const channelId = selectedChannel.value.id
  const messageContent = composerStore.newMessage.trim()
  const imageToSend = composerStore.selectedImage
  const replyId = composerStore.replyingTo?.id
  const replyUsername = (composerStore.replyingTo as Message)?.username || (composerStore.replyingTo as DirectMessageMessage)?.senderUsername
  const replyContent = composerStore.replyingTo?.content

  // Validate message content if present
  if (messageContent) {
    const validation = messageSchema.safeParse({ content: messageContent })
    if (!validation.success) {
      validationError.value = validation.error.issues[0]?.message || 'Invalid message'
      return
    }
  } else if (!imageToSend) {
    validationError.value = 'Message cannot be empty'
    return
  }

  try {
    validationError.value = null
    await sendMessageToServer(channelId, messageContent, imageToSend, replyId, replyUsername, replyContent)
    resetComposer()
  } catch (err: unknown) {
    console.error('Failed to send message:', err)
    if (messageContent && !composerStore.newMessage) {
      composerStore.setMessage(messageContent)
    }
    error.value = err instanceof Error ? err.message : 'Failed to send message. Please try again.'
  }
}

const isClient = ref(false)

watch(() => composerStore.newMessage, (newValue) => {
  if (newValue && newValue.trim()) {
    const validation = messageSchema.safeParse({ content: newValue })
    if (!validation.success) {
      validationError.value = validation.error.issues[0]?.message || 'Invalid message'
    } else {
      validationError.value = null
    }
  } else {
    validationError.value = null
  }
})

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
    await joinVoiceChannel(channelId)
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
}

onMounted(async () => {
  isClient.value = true

  await channelsStore.fetchChannels()
  await fetchUsers()

  // Wait for WebSocket connection if not already connected
  // Plugin handles auto-connect, but we may need to wait briefly on initial load
  if (!isConnected.value) {
    let attempts = 0
    while (!isConnected.value && attempts < 20) {
      await new Promise(resolve => setTimeout(resolve, 250))
      attempts++
    }
  }

  if (isConnected.value) {
    try {
      if (user.value && user.value.userId) {
        updateUserPresence(user.value.userId, 'online')
        userPresenceStore.setUserPresence(user.value.userId, 'online')
      }

      const selectedChannelId = computed(() => selectedChannel.value?.id ?? null)

      subscribeToGlobal(
        (channelId: number) => channelsStore.incrementUnreadCount(channelId),
        (update: { userId: number, username: string, status: 'online' | 'offline' }) => {
          updateUserPresence(update.userId, update.status)
          userPresenceStore.updateUserPresence({ userId: update.userId, status: update.status })
          if (!usersWithFullData.value.some((u: typeof usersWithFullData.value[0]) => u.userId === update.userId)) {
            addUser(update.userId, update.username, update.status)
          }
        },
        selectedChannelId
      )

      // Subscribe to direct messages for notifications
      if (user.value?.userId) {
        dmSubscription = subscribeToUserDirectMessages(user.value.userId, (message) => {
          // Update DM list if not on messages page
          const dm = directMessagesStore.directMessages.find(d => d.id === message.directMessageId)
          if (dm) {
            dm.lastMessageContent = message.content
            dm.lastMessageAt = new Date(message.createdAt)
            dm.unreadCount = (dm.unreadCount || 0) + 1
          } else {
            // Refresh DM list if we received a message for a new DM
            directMessagesStore.fetchAllDirectMessages()
          }
        })
      }
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
  composerStore.cleanup()
  if (dmSubscription) {
    dmSubscription.unsubscribe()
  }
  // Don't disconnect WebSocket - keep it alive for the session
  // The WebSocket plugin handles connection lifecycle
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

watch(() => composerStore.showGifPicker, (open) => {
  if (!open && gifPickerRef.value) {
    gifPickerRef.value.reset()
  }
})

watch(usersWithFullData, () => {
  if (user.value && user.value.userId) {
    const currentUserIndex = usersWithFullData.value.findIndex((u: typeof usersWithFullData.value[0]) => u.userId === user.value!.userId)
    if (currentUserIndex !== -1 && usersWithFullData.value[currentUserIndex]!.status !== 'online') {
      usersWithFullData.value[currentUserIndex]!.status = 'online'
      updateUserPresence(user.value.userId, 'online')
      userPresenceStore.setUserPresence(user.value.userId, 'online')
    }
  }

  // Sync all users to presence store
  usersWithFullData.value.forEach((u) => {
    userPresenceStore.setUserPresence(u.userId, u.status)
  })
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
          <div class="ml-auto flex items-center gap-3">
            <UButton
              :icon="$colorMode.value === 'dark' ? 'i-lucide-moon' : 'i-lucide-sun'"
              color="neutral"
              variant="ghost"
              :aria-label="$colorMode.value === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
              @click="$colorMode.preference = $colorMode.value === 'dark' ? 'light' : 'dark'"
            />
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
            @reply-to-message="setReplyingTo"
          />

          <div
            class="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4"
          >
            <div v-if="validationError" class="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm flex items-start gap-2">
              <UIcon name="i-lucide-alert-circle" class="w-4 h-4 mt-0.5 shrink-0" />
              <span>{{ validationError }}</span>
            </div>

            <div
              v-if="composerStore.replyingTo"
              class="mb-2 p-2 bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500 rounded-r flex items-center justify-between"
            >
              <div class="flex-1">
                <div class="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 mb-1">
                  <UIcon name="i-lucide-reply" class="w-3 h-3" />
                  <span class="font-semibold">Replying to {{ (composerStore.replyingTo as any).username || (composerStore.replyingTo as any).senderUsername }}</span>
                </div>
                <p class="text-sm text-gray-700 dark:text-gray-300 line-clamp-1">
                  {{ composerStore.replyingTo.content }}
                </p>
              </div>
              <button
                type="button"
                class="ml-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                @click="cancelReply"
              >
                <UIcon name="i-lucide-x" class="w-4 h-4" />
              </button>
            </div>

            <div
              v-if="composerStore.imagePreviewUrl"
              class="mb-2 relative inline-block"
            >
              <img :src="composerStore.imagePreviewUrl" alt="Preview" class="max-h-32 rounded">
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
                  @click="composerStore.toggleEmojiPicker()"
                />
                <div
                  v-if="composerStore.showEmojiPicker"
                  class="absolute bottom-full mb-2 left-0 z-20"
                >
                  <EmojiPicker @select="addEmoji" />
                </div>

                <UButton
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-image"
                  aria-label="Insert GIF"
                  @click="composerStore.toggleGifPicker()"
                />
                <div
                  v-if="composerStore.showGifPicker"
                  class="absolute bottom-full mb-2 left-0 z-20"
                >
                  <GifPicker ref="gifPickerRef" @select="addGif" />
                </div>
              </div>

              <UTextarea
                v-model="composerStore.newMessage"
                placeholder="Type a message..."
                :rows="1"
                :maxrows="6"
                autoresize
                class="flex-1"
                @keydown.enter.exact.prevent="sendMessage"
              />

              <UButton
                type="submit"
                icon="i-lucide-send"
                color="primary"
                :disabled="!composerStore.hasContent || !!validationError"
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

      <UserPanel :users="usersWithFullData" />
    </div>
  </ClientOnly>
</template>
