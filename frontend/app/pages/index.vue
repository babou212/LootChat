<script setup lang="ts">
import type { Channel, Message } from '../../shared/types/chat'
import { messageApi, channelApi, userApi, type MessageResponse, type ChannelResponse, type UserResponse } from '~/utils/api'
import MessageList from '~/components/MessageList.vue'
import VoiceChannel from '~/components/VoiceChannel.vue'
import UserMenu from '~/components/UserMenu.vue'
import EmojiPicker from '~/components/EmojiPicker.vue'
import UserPanel from '~/components/UserPanel.vue'
import type { UserPresence } from '~/components/UserPanel.vue'
import type GifPicker from '~/components/GifPicker.vue'
import type { StompSubscription } from '@stomp/stompjs'
import type { UserPresenceUpdate } from '~/composables/useWebSocket'
import { useAuthStore } from '../../stores/auth'
import type { User } from '../../shared/types/user'

definePageMeta({ middleware: 'auth' })

const { token, user } = useAuth()
const authStore = useAuthStore()
const { connect, disconnect, subscribeToChannel, subscribeToAllMessages, subscribeToUserPresence, subscribeToChannelReactions, subscribeToChannelReactionRemovals, getClient } = useWebSocket()

const channels = ref<Channel[]>([])

const selectedChannel = ref<Channel | null>(null)

const messages = ref<Message[]>([])

const users = ref<UserPresence[]>([])

const stompClient = computed(() => getClient())

let subscription: StompSubscription | null = null
let allMessagesSubscription: StompSubscription | null = null
let userPresenceSubscription: StompSubscription | null = null
let channelReactionSubscription: StompSubscription | null = null
let channelReactionRemovalSubscription: StompSubscription | null = null

const newMessage = ref('')
const loading = ref(true)
const error = ref<string | null>(null)

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

const selectChannel = async (channel: Channel) => {
  selectedChannel.value = channel

  const channelIndex = channels.value.findIndex(ch => ch.id === channel.id)
  if (channelIndex !== -1) {
    channels.value[channelIndex]!.unread = 0
  }

  // Only fetch messages and subscribe for text channels
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

    if (token.value) {
      subscription = subscribeToChannel(channel.id, (newMessage) => {
        const exists = messages.value.find(m => m.id === newMessage.id)
        if (!exists) {
          const converted = convertToMessage(newMessage)
          messages.value.push(converted)
          messages.value.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
        } else {
          const index = messages.value.findIndex(m => m.id === newMessage.id)
          if (index !== -1) {
            messages.value[index] = convertToMessage(newMessage)
          }
        }
      })

      // Subscribe to reactions for this channel
      channelReactionSubscription = subscribeToChannelReactions(channel.id, (reaction) => {
        const messageIndex = messages.value.findIndex(m => m.id === reaction.messageId)
        if (messageIndex !== -1) {
          const message = messages.value[messageIndex]!
          if (!message.reactions) {
            message.reactions = []
          }
          // Check if reaction already exists
          const existingReactionIndex = message.reactions.findIndex(
            r => r.id === reaction.id
          )
          if (existingReactionIndex === -1) {
            message.reactions.push({
              id: reaction.id,
              emoji: reaction.emoji,
              userId: reaction.userId,
              username: reaction.username,
              createdAt: new Date(reaction.createdAt)
            })
          }
        }
      })

      // Subscribe to reaction removals for this channel
      channelReactionRemovalSubscription = subscribeToChannelReactionRemovals(channel.id, (reaction) => {
        const messageIndex = messages.value.findIndex(m => m.id === reaction.messageId)
        if (messageIndex !== -1) {
          const message = messages.value[messageIndex]!
          if (message.reactions) {
            message.reactions = message.reactions.filter(r => r.id !== reaction.id)
          }
        }
      })
    }
  } else {
    // Clear messages for voice channels
    messages.value = []
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

const convertToMessage = (apiMessage: MessageResponse): Message => {
  return {
    id: apiMessage.id,
    userId: apiMessage.userId.toString(),
    username: apiMessage.username,
    content: apiMessage.content,
    timestamp: new Date(apiMessage.createdAt),
    avatar: apiMessage.avatar,
    channelId: apiMessage.channelId,
    channelName: apiMessage.channelName,
    reactions: apiMessage.reactions?.map(r => ({
      id: r.id,
      emoji: r.emoji,
      userId: r.userId,
      username: r.username,
      createdAt: new Date(r.createdAt)
    })) || []
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

const fetchUsers = async () => {
  try {
    const authToken = useCookie<string | null>('auth_token')
    if (!authToken.value || !user.value) {
      return navigateTo('/login')
    }

    const apiUsers = await userApi.getAllUsers(authToken.value)

    // Fetch current presence state
    let presenceMap: Record<number, boolean> = {}
    try {
      presenceMap = await userApi.getUserPresence(authToken.value)
    } catch {
      console.log('Failed to fetch initial presence, will rely on WebSocket updates')
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

    // Mark current user as online immediately
    if (user.value && user.value.userId) {
      const currentUserIndex = users.value.findIndex(u => u.userId === user.value!.userId)
      if (currentUserIndex !== -1) {
        users.value[currentUserIndex]!.status = 'online'

        // Update current user's avatar if they don't have one in their auth data
        const currentUserData = users.value[currentUserIndex]
        if (currentUserData && currentUserData.avatar && !user.value.avatar) {
          console.log('Updating current user avatar from user list:', currentUserData.avatar)
          // Update the auth store and cookie with the avatar
          const updatedUser: User = { ...user.value, avatar: currentUserData.avatar }
          authStore.setAuth(updatedUser, token.value!)
          const authUserCookie = useCookie<User | null>('auth_user', {
            maxAge: 60 * 60 * 24 * 7,
            sameSite: 'strict',
            secure: process.env.NODE_ENV === 'production',
            path: '/'
          })
          authUserCookie.value = updatedUser
        }
      } else {
        // Add current user if not in the list
        console.log('Adding current user to the list')
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
  } catch (err) {
    console.error('Failed to fetch users:', err)
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
    messages.value = apiMessages
      .map(convertToMessage)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
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
    await messageApi.createMessage(
      {
        content: newMessage.value,
        userId: user.value.userId,
        channelId: selectedChannel.value.id
      },
      token.value
    )

    newMessage.value = ''
  } catch (err) {
    console.error('Failed to send message:', err)
    error.value = 'Failed to send message'
  }
}

onMounted(async () => {
  await fetchChannels()
  await fetchUsers()

  if (token.value) {
    try {
      await connect(token.value)

      // Mark current user as online after WebSocket connection
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

      userPresenceSubscription = subscribeToUserPresence((update: UserPresenceUpdate) => {
        console.log('Received presence update:', update)
        const userIndex = users.value.findIndex(u => u.userId === update.userId)
        if (userIndex !== -1) {
          // Update status, but ensure current user is always shown as online
          if (user.value && update.userId === user.value.userId) {
            users.value[userIndex]!.status = 'online'
            console.log(`Current user ${update.username} always shown as online`)
          } else {
            users.value[userIndex]!.status = update.status
            console.log(`Updated user ${update.username} to ${update.status}`)
          }
        } else {
          // User not in list, might be a new user
          console.log(`Adding new user ${update.username}`)
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
  disconnect()
})

watch(channels, (newChannels) => {
  if (newChannels.length > 0 && !selectedChannel.value) {
    selectChannel(newChannels[0]!)
  }
}, { immediate: true })

watch(showGifPicker, (open) => {
  if (!open && gifPickerRef.value) {
    gifPickerRef.value.reset()
  }
})

// Ensure current user is always shown as online
watch(users, () => {
  if (user.value && user.value.userId) {
    const currentUserIndex = users.value.findIndex(u => u.userId === user.value!.userId)
    if (currentUserIndex !== -1 && users.value[currentUserIndex]!.status !== 'online') {
      users.value[currentUserIndex]!.status = 'online'
      console.log('Ensured current user is marked as online')
    }
  }
}, { deep: true })
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

      <!-- Text Channel View -->
      <template v-if="selectedChannel?.channelType === 'TEXT'">
        <MessageList :messages="messages" :loading="loading" :error="error" />

        <div class="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
          <form class="flex items-center gap-2" @submit.prevent="sendMessage">
            <div ref="pickerWrapperRef" class="relative flex items-center gap-1">
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
      </template>

      <!-- Voice Channel View -->
      <VoiceChannel
        v-else-if="selectedChannel?.channelType === 'VOICE'"
        :channel="selectedChannel"
        :stomp-client="stompClient"
      />
    </div>

    <!-- User Panel -->
    <UserPanel :users="users" />
  </div>
</template>
