<script setup lang="ts">
import type { Channel } from '../../shared/types/chat'
import type { MessageResponse } from '~/api/messageApi'
import type { ChannelResponse } from '~/api/channelApi'
import type { UserResponse } from '~/api/userApi'
import MessageList from '~/components/MessageList.vue'
import UserMenu from '~/components/UserMenu.vue'
import EmojiPicker from '~/components/EmojiPicker.vue'
import UserPanel from '~/components/UserPanel.vue'
import type { UserPresence } from '~/components/UserPanel.vue'
import type GifPicker from '~/components/GifPicker.vue'
import type { StompSubscription } from '@stomp/stompjs'
import type { UserPresenceUpdate } from '~/composables/useWebSocket'
import { useAuthStore } from '../../stores/auth'
import { useMessagesStore } from '../../stores/messages'
import type { User } from '../../shared/types/user'

definePageMeta({
  middleware: 'auth',
  ssr: false
})

const { user } = useAuth()
const authStore = useAuthStore()
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

const { connect, disconnect, subscribeToChannel, subscribeToAllMessages, subscribeToUserPresence, subscribeToChannelReactions, subscribeToChannelReactionRemovals, subscribeToChannelMessageDeletions, subscribeToGlobalMessageDeletions, getClient, isConnected: wsConnected } = useWebSocket()

const { joinVoiceChannel, leaveVoiceChannel } = useWebRTC()

const channels = ref<Channel[]>([])

const selectedChannel = ref<Channel | null>(null)

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

const users = ref<UserPresence[]>([])

const stompClient = computed(() => getClient())

let subscription: StompSubscription | null = null
let allMessagesSubscription: StompSubscription | null = null
let userPresenceSubscription: StompSubscription | null = null
let channelReactionSubscription: StompSubscription | null = null
let channelReactionRemovalSubscription: StompSubscription | null = null
let channelMessageDeletionSubscription: StompSubscription | null = null
let globalMessageDeletionSubscription: StompSubscription | null = null

const newMessage = ref('')
const loading = ref(true)
const error = ref<string | null>(null)

const selectedImage = ref<File | null>(null)
const imagePreviewUrl = ref<string | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

const showEmojiPicker = ref(false)
const showGifPicker = ref(false)
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

const addEmoji = (emoji: string) => {
  newMessage.value += (newMessage.value && !newMessage.value.endsWith(' ') ? ' ' : '') + emoji
  showEmojiPicker.value = false
}

const addGifToMessage = (gifUrl: string) => {
  const spacer = newMessage.value && !newMessage.value.endsWith(' ') ? ' ' : ''
  newMessage.value = `${newMessage.value}${spacer}${gifUrl}`.trim()
  showGifPicker.value = false
}

const handleImageSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    const maxSizeInMB = 50
    const fileSizeInMB = file.size / (1024 * 1024)

    if (fileSizeInMB > maxSizeInMB) {
      error.value = `File size (${fileSizeInMB.toFixed(2)}MB) exceeds maximum limit of ${maxSizeInMB}MB`
      if (fileInputRef.value) {
        fileInputRef.value.value = ''
      }
      return
    }

    if (!file.type.startsWith('image/')) {
      error.value = 'Please select an image file'
      if (fileInputRef.value) {
        fileInputRef.value.value = ''
      }
      return
    }
    selectedImage.value = file
    imagePreviewUrl.value = URL.createObjectURL(file)
    error.value = null
  }
}

const removeImage = () => {
  if (imagePreviewUrl.value) {
    URL.revokeObjectURL(imagePreviewUrl.value)
  }
  selectedImage.value = null
  imagePreviewUrl.value = null
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

const selectChannel = async (channel: Channel) => {
  if (channel.channelType === 'VOICE') {
    return
  }

  selectedChannel.value = channel

  const channelIndex = channels.value.findIndex(ch => ch.id === channel.id)
  if (channelIndex !== -1) {
    channels.value[channelIndex]!.unread = 0
  }

  loadingMoreMessages.value = false

  if (channel.channelType === 'TEXT' || !channel.channelType) {
    await fetchMessages()

    if (subscription) {
      subscription.unsubscribe()
    }
    if (channelReactionSubscription) {
      channelReactionSubscription.unsubscribe()
    }
    if (channelReactionRemovalSubscription) {
      channelReactionRemovalSubscription.unsubscribe()
    }
    if (channelMessageDeletionSubscription) {
      channelMessageDeletionSubscription.unsubscribe()
    }

    if (token.value) {
      if (!wsConnected.value) {
        let attempts = 0
        while (!wsConnected.value && attempts < 20) {
          await new Promise(resolve => setTimeout(resolve, 250))
          attempts++
        }

        if (!wsConnected.value) {
          console.error('WebSocket connection timeout - cannot subscribe to channel')
          return
        }
      }

      subscription = subscribeToChannel(channel.id, (newMessage) => {
        messagesStore.addMessage(channel.id, messagesStore.convertToMessage(newMessage))
      })

      if (!subscription) {
        console.warn('Failed to subscribe to channel messages - WebSocket may not be connected')
      }

      channelReactionSubscription = subscribeToChannelReactions(channel.id, (reaction) => {
        if (reaction.messageId) {
          messagesStore.addReaction(channel.id, reaction.messageId, {
            id: reaction.id,
            emoji: reaction.emoji,
            userId: reaction.userId,
            username: reaction.username,
            createdAt: new Date(reaction.createdAt)
          })
        }
      })

      channelReactionRemovalSubscription = subscribeToChannelReactionRemovals(channel.id, (reaction) => {
        if (reaction.messageId) {
          messagesStore.removeReaction(channel.id, reaction.messageId, reaction.id)
        }
      })

      channelMessageDeletionSubscription = subscribeToChannelMessageDeletions(channel.id, (payload) => {
        if (payload && typeof payload.id === 'number') {
          messagesStore.removeMessage(channel.id, payload.id)
        }
      })
    }
  } else {
    if (subscription) {
      subscription.unsubscribe()
      subscription = null
    }
    if (channelReactionSubscription) {
      channelReactionSubscription.unsubscribe()
      channelReactionSubscription = null
    }
    if (channelReactionRemovalSubscription) {
      channelReactionRemovalSubscription.unsubscribe()
      channelReactionRemovalSubscription = null
    }
    if (channelMessageDeletionSubscription) {
      channelMessageDeletionSubscription.unsubscribe()
      channelMessageDeletionSubscription = null
    }
  }
}

const convertToChannel = (apiChannel: ChannelResponse): Channel => {
  return {
    id: apiChannel.id,
    name: apiChannel.name,
    description: apiChannel.description,
    channelType: apiChannel.channelType || 'TEXT',
    createdAt: apiChannel.createdAt,
    updatedAt: apiChannel.updatedAt,
    unread: 0
  }
}

const fetchChannels = async () => {
  try {
    if (!user.value) {
      return navigateTo('/login')
    }

    const apiChannels = await $fetch<ChannelResponse[]>('/api/channels')
    channels.value = apiChannels.map(convertToChannel)
  } catch (err) {
    console.error('Failed to fetch channels:', err)
    error.value = 'Failed to load channels'
  }
}

const fetchUsers = async () => {
  try {
    if (!user.value) {
      return navigateTo('/login')
    }

    const apiUsers = await $fetch<UserResponse[]>('/api/users')

    let presenceMap: Record<number, boolean> = {}
    try {
      presenceMap = await $fetch<Record<number, boolean>>('/api/users/presence')
    } catch {
      // ignore errors for now
    }

    users.value = apiUsers.map((apiUser: UserResponse): UserPresence => {
      const isOnline = presenceMap[apiUser.id] === true
      return {
        userId: apiUser.id,
        username: apiUser.username,
        email: apiUser.email,
        firstName: apiUser.firstName,
        lastName: apiUser.lastName,
        role: apiUser.role,
        avatar: apiUser.avatar,
        status: isOnline ? 'online' : 'offline'
      }
    })

    if (user.value && user.value.userId) {
      const currentUserIndex = users.value.findIndex(u => u.userId === user.value!.userId)
      if (currentUserIndex !== -1) {
        users.value[currentUserIndex]!.status = 'online'

        const currentUserData = users.value[currentUserIndex]
        if (currentUserData && currentUserData.avatar && !user.value.avatar) {
          const updatedUser: User = { ...user.value, avatar: currentUserData.avatar }
          authStore.setUser(updatedUser)
        }
      } else {
        users.value.push({
          userId: user.value.userId,
          username: user.value.username,
          email: user.value.email,
          firstName: undefined,
          lastName: undefined,
          role: user.value.role,
          avatar: user.value.avatar,
          status: 'online'
        })
      }
    }
  } catch {
    // ignore errors for now
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
  let optimisticId: number | null = null

  try {
    error.value = null

    if (!imageToSend && messageContent) {
      optimisticId = -Date.now()
      messagesStore.addOptimisticMessage(channelId, {
        optimisticId,
        userId: user.value.userId.toString(),
        username: user.value.username,
        content: messageContent,
        timestamp: new Date(),
        avatar: user.value.avatar,
        channelId,
        reactions: []
      })
    }

    newMessage.value = ''

    if (imageToSend) {
      const formData = new FormData()
      formData.append('image', imageToSend)
      formData.append('channelId', channelId.toString())
      if (messageContent) {
        formData.append('content', messageContent)
      }

      const response = await $fetch<MessageResponse>('/api/messages/upload', {
        method: 'POST',
        body: formData
      })

      messagesStore.addMessage(channelId, messagesStore.convertToMessage(response))
      removeImage()
    } else {
      const response = await $fetch<MessageResponse>('/api/messages', {
        method: 'POST',
        body: {
          content: messageContent,
          userId: user.value.userId,
          channelId
        }
      })

      if (optimisticId) {
        messagesStore.confirmOptimisticMessage(
          channelId,
          optimisticId,
          messagesStore.convertToMessage(response)
        )
      }
    }
  } catch (err: unknown) {
    console.error('Failed to send message:', err)

    if (optimisticId) {
      messagesStore.rollbackOptimisticMessage(channelId, optimisticId)
    }

    if (messageContent && !newMessage.value) {
      newMessage.value = messageContent
    }

    const errorMessage = err instanceof Error ? err.message : String(err)
    error.value = errorMessage.includes('413')
      ? 'Image file is too large. Maximum size is 50MB.'
      : errorMessage.includes('upload')
        ? 'Failed to upload image. Please try again.'
        : 'Failed to send message. Please try again.'
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
        const currentUserIndex = users.value.findIndex(u => u.userId === user.value!.userId)
        if (currentUserIndex !== -1) {
          users.value[currentUserIndex]!.status = 'online'
        }
      }

      allMessagesSubscription = subscribeToAllMessages((newMessage) => {
        if (newMessage.channelId && selectedChannel.value && newMessage.channelId !== selectedChannel.value.id) {
          const channelIndex = channels.value.findIndex(ch => ch.id === newMessage.channelId)
          if (channelIndex !== -1) {
            const currentUnread = channels.value[channelIndex]!.unread || 0
            channels.value[channelIndex]!.unread = currentUnread + 1
          }
        }
      })

      globalMessageDeletionSubscription = subscribeToGlobalMessageDeletions((payload) => {
        if (!payload) return
        if (selectedChannel.value && payload.channelId === selectedChannel.value.id) {
          messagesStore.removeMessage(selectedChannel.value.id, payload.id)
        }
      })

      userPresenceSubscription = subscribeToUserPresence((update: UserPresenceUpdate) => {
        const userIndex = users.value.findIndex(u => u.userId === update.userId)
        if (userIndex !== -1) {
          if (user.value && update.userId === user.value.userId) {
            users.value[userIndex]!.status = 'online'
          } else {
            users.value[userIndex]!.status = update.status
          }
        } else {
          users.value.push({
            userId: update.userId,
            username: update.username,
            email: '',
            role: 'USER',
            status: update.status
          })
        }
      })
    } catch (err) {
      console.error('Failed to connect to WebSocket:', err)
    }
  }

  if (channels.value.length > 0) {
    await selectChannel(channels.value[0]!)
  }
})

onUnmounted(() => {
  if (subscription) {
    subscription.unsubscribe()
  }
  if (allMessagesSubscription) {
    allMessagesSubscription.unsubscribe()
  }
  if (userPresenceSubscription) {
    userPresenceSubscription.unsubscribe()
  }
  if (channelReactionSubscription) {
    channelReactionSubscription.unsubscribe()
  }
  if (channelReactionRemovalSubscription) {
    channelReactionRemovalSubscription.unsubscribe()
  }
  if (channelMessageDeletionSubscription) {
    channelMessageDeletionSubscription.unsubscribe()
  }
  if (globalMessageDeletionSubscription) {
    globalMessageDeletionSubscription.unsubscribe()
  }
  if (imagePreviewUrl.value) {
    URL.revokeObjectURL(imagePreviewUrl.value)
  }
  disconnect()
})

watch(channels, (newChannels) => {
  if (newChannels.length > 0 && !selectedChannel.value) {
    const firstTextChannel = newChannels.find(ch => !ch.channelType || ch.channelType === 'TEXT')
    if (firstTextChannel) {
      selectChannel(firstTextChannel)
    }
  }
})

watch(() => user.value?.avatar, (newAvatar) => {
  if (user.value && user.value.userId) {
    const userIndex = users.value.findIndex(u => u.userId === user.value!.userId)
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
    const currentUserIndex = users.value.findIndex(u => u.userId === user.value!.userId)
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
                  <GifPicker ref="gifPickerRef" @select="addGifToMessage" />
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
