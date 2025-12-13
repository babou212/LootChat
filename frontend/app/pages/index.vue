<script setup lang="ts">
import { z } from 'zod'
import type GifPicker from '~/components/chat/GifPicker.vue'
import MentionAutocomplete from '~/components/chat/MentionAutocomplete.vue'
import type { Message } from '../../shared/types/chat'
import type { DirectMessageMessage } from '../../shared/types/directMessage'
import { useMessagesStore } from '../../stores/messages'
import { useDirectMessagesStore } from '../../stores/directMessages'
import { useChannelsStore } from '../../stores/channels'
import { useUsersStore } from '../../stores/users'
import { useComposerStore } from '../../stores/composer'
import { useWebSocketStore } from '../../stores/websocket'
import type { ScreenShareInfo } from '../../stores/livekit'
import type { UserPresence } from '../../shared/types/user'

const messageSchema = z.object({
  content: z.string()
    .min(1, 'Message cannot be empty')
    .max(50000, 'Message must be less than 50000 characters')
    .trim()
    .refine(val => val.length > 0, 'Message cannot be only whitespace')
})

definePageMeta({
  middleware: 'auth'
})

const { user } = useAuth()
const messagesStore = useMessagesStore()
const directMessagesStore = useDirectMessagesStore()
const channelsStore = useChannelsStore()
const usersStore = useUsersStore()
const composerStore = useComposerStore()
const websocketStore = useWebSocketStore()

const { getClient, isConnected, subscribeToUserDirectMessages, subscribeToPresenceSync, subscribeToMentions } = useWebSocket()
const { joinVoiceChannel, leaveVoiceChannel, activeScreenShares } = useLiveKit()
const { sendMessage: sendMessageToServer } = useMessageSender()
const { subscribeToChannelUpdates, unsubscribeAll: unsubscribeChannel } = useChannelSubscriptions()
const { subscribeToGlobal, unsubscribeAll: unsubscribeGlobal } = useGlobalSubscriptions()

// Initialize presence heartbeat
usePresenceHeartbeat()

// Initialize notifications and mentions
const { requestPermission } = useNotifications()
const { handleMentionNotification } = useMentions()

// Presence sync subscription ref
let presenceSyncSubscription: ReturnType<typeof subscribeToPresenceSync> = null
let mentionSubscription: ReturnType<typeof subscribeToMentions> = null

// Screen share viewer state
const selectedScreenShareId = ref<string | null>(null)
const isScreenShareMinimized = ref(false)

const selectedScreenShare = computed((): ScreenShareInfo | null => {
  if (!selectedScreenShareId.value) return null
  return activeScreenShares.value.find((s: ScreenShareInfo) => s.odod === selectedScreenShareId.value) || null
})

const handleViewScreenShare = (sharerId: string) => {
  selectedScreenShareId.value = sharerId
  isScreenShareMinimized.value = false
}

const handleCloseScreenShare = () => {
  selectedScreenShareId.value = null
  isScreenShareMinimized.value = false
}

const handleToggleMinimizeScreenShare = () => {
  isScreenShareMinimized.value = !isScreenShareMinimized.value
}

// Auto-close viewer when screen share ends
watch(() => activeScreenShares.value, (shares) => {
  if (selectedScreenShareId.value && !shares.find(s => s.odod === selectedScreenShareId.value)) {
    selectedScreenShareId.value = null
  }
}, { deep: true })

// Keep usersComposable for full user data with email/role for UserPanel
const usersComposable = useUsers()
const usersWithFullData = usersComposable.users
const fetchUsers = usersComposable.fetchUsers
const updateUserPresence = usersComposable.updateUserPresence
const addUser = usersComposable.addUser

// Search modal state
const showSearchModal = ref(false)

// Highlight message state
const route = useRoute()
const highlightMessageId = ref<number | null>(null)
const messageListRef = ref<{ scrollToMessage: (id: number) => void } | null>(null)

// Keyboard shortcut for search (Cmd+K / Ctrl+K)
onMounted(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      showSearchModal.value = true
    }
  }
  window.addEventListener('keydown', handleKeyDown)
  onUnmounted(() => window.removeEventListener('keydown', handleKeyDown))
})

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
const emojiPickerContainerRef = ref<HTMLElement | null>(null)
const gifPickerContainerRef = ref<HTMLElement | null>(null)
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

// Mention autocomplete
const specialMentions = [
  { name: 'everyone', type: 'special' as const, description: 'Notify all users' },
  { name: 'here', type: 'special' as const, description: 'Notify online users' }
]

const handleMessageInput = async (event: Event) => {
  const textarea = event.target as HTMLTextAreaElement
  const cursorPos = textarea.selectionStart || 0
  composerStore.setCursorPosition(cursorPos)

  const beforeCursor = composerStore.newMessage.slice(0, cursorPos)
  const mentionMatch = beforeCursor.match(/@(\w*)$/)

  if (mentionMatch) {
    const query = mentionMatch[1] || ''
    composerStore.setMentionQuery(query)
    composerStore.showMentions()
    composerStore.setMentionLoading(true)

    try {
      const response = await $fetch<string[]>('/api/mentions/users/search', {
        params: { prefix: query }
      })

      // Filter out current user and combine with special mentions
      const userSuggestions = response
        .filter(username => username !== user.value?.username)
        .map(username => ({
          name: username,
          type: 'user' as const
        }))

      // Filter special mentions by query
      const filteredSpecial = query
        ? specialMentions.filter(m => m.name.startsWith(query.toLowerCase()))
        : specialMentions

      composerStore.setMentionSuggestions([...filteredSpecial, ...userSuggestions].slice(0, 10))
    } catch (err) {
      console.error('Failed to fetch mention suggestions:', err)
      composerStore.setMentionSuggestions(specialMentions)
    } finally {
      composerStore.setMentionLoading(false)
    }
  } else {
    composerStore.hideMentions()
  }
}

const handleMentionSelect = (mention: string) => {
  composerStore.insertMention(mention)
  // Focus back on textarea after selection
  nextTick(() => {
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement
    if (textarea) {
      textarea.focus()
    }
  })
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
  {
    active: computed(() => composerStore.isPickerOpen),
    ignore: [emojiPickerContainerRef, gifPickerContainerRef]
  }
)

const handleMessageHighlight = async (channelId: number, targetMessageId: number) => {
  try {
    // Check if message is already loaded
    let messages = messagesStore.getChannelMessages(channelId)
    let messageFound = messages.some((m: Message) => m.id === targetMessageId)

    // Keep loading older messages until we find the target
    let loadAttempts = 0
    const maxAttempts = 100
    let previousMessageCount = messages.length
    let noNewMessagesCount = 0

    while (!messageFound && loadAttempts < maxAttempts) {
      // Try to load more messages
      await fetchMessages(true)
      messages = messagesStore.getChannelMessages(channelId)
      messageFound = messages.some((m: Message) => m.id === targetMessageId)

      // If message count didn't change, we've reached the end
      if (messages.length === previousMessageCount) {
        noNewMessagesCount++

        // Try 3 times before giving up (sometimes the first request fails)
        if (noNewMessagesCount >= 3) {
          break
        }

        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 200))
      } else {
        noNewMessagesCount = 0 // Reset counter if we got new messages
      }

      previousMessageCount = messages.length
      loadAttempts++
    }

    if (messageFound) {
      // Set highlight state
      highlightMessageId.value = targetMessageId

      // Wait for DOM update and virtualizer to render
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 300))

      // Clear query params immediately before scrolling
      navigateTo({ query: { ...route.query, highlight: undefined, channel: undefined } }, { replace: true })

      // Use MessageList's scrollToMessage method which handles virtualizer properly
      if (messageListRef.value) {
        messageListRef.value.scrollToMessage(targetMessageId)
      } else {
        // Fallback to manual scroll if ref not available
        const messageElement = document.getElementById(`message-${targetMessageId}`)
        if (messageElement) {
          messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }

      // Remove highlight after 5 seconds
      setTimeout(() => {
        highlightMessageId.value = null
      }, 5000)
    }
  } catch (error) {
    console.error('Failed to highlight message:', error)
  }
}

const selectChannel = async (channel: typeof channels.value[0]) => {
  if (channel.channelType === 'VOICE') {
    return
  }

  channelsStore.selectChannel(channel)
  channelsStore.markChannelAsRead(channel.id)
  loadingMoreMessages.value = false

  if (channel.channelType === 'TEXT' || !channel.channelType) {
    await fetchMessages()

    // Handle highlight parameter from search navigation
    const highlightParam = route.query.highlight
    if (highlightParam) {
      const targetMessageId = Number(highlightParam)
      await handleMessageHighlight(channel.id, targetMessageId)
    }

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
      loading.value = false
      loadingMoreMessages.value = false
      return navigateTo('/login')
    }

    const channelId = selectedChannel.value?.id
    if (!channelId) {
      loading.value = false
      loadingMoreMessages.value = false
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
        usersStore.setUserPresence(user.value.userId, 'online')
      }

      const selectedChannelId = computed(() => selectedChannel.value?.id ?? null)

      subscribeToGlobal(
        (channelId: number) => channelsStore.incrementUnreadCount(channelId),
        (update: { userId: number, username: string, status: 'online' | 'offline' }) => {
          updateUserPresence(update.userId, update.status)
          usersStore.setUserPresence(update.userId, update.status)
          if (!usersWithFullData.value.some((u: UserPresence) => u.userId === update.userId)) {
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

      // Subscribe to presence sync for bulk presence updates
      // This ensures we have accurate presence info even if individual updates were missed
      presenceSyncSubscription = subscribeToPresenceSync((updates) => {
        // First, mark all users as offline
        usersWithFullData.value.forEach((u: UserPresence) => {
          if (u.userId !== user.value?.userId) { // Don't mark ourselves offline
            updateUserPresence(u.userId, 'offline')
            usersStore.setUserPresence(u.userId, 'offline')
          }
        })

        // Then, mark online users from the sync
        updates.forEach((update: { userId: number, username: string }) => {
          updateUserPresence(update.userId, 'online')
          usersStore.setUserPresence(update.userId, 'online')
          if (!usersWithFullData.value.some((u: UserPresence) => u.userId === update.userId)) {
            addUser(update.userId, update.username, 'online')
          }
        })
      })

      // Subscribe to mention notifications
      if (user.value?.userId) {
        // Request notification permission on first load
        requestPermission()

        mentionSubscription = subscribeToMentions(user.value.userId, (notification) => {
          handleMentionNotification(notification)
        })
      }
    } catch (err) {
      console.error('Failed to connect to WebSocket:', err)
    }
  }

  if (channels.value.length > 0) {
    // Check if there's a channel query param (from search navigation)
    const channelIdParam = route.query.channel
    if (channelIdParam) {
      const channelId = Number(channelIdParam)
      const targetChannel = channels.value.find((ch: typeof channels.value[0]) => ch.id === channelId)
      if (targetChannel) {
        await selectChannel(targetChannel)
      } else {
        await selectChannel(channels.value[0]!)
      }
    } else {
      await selectChannel(channels.value[0]!)
    }
  }
})

onUnmounted(() => {
  unsubscribeChannel()
  unsubscribeGlobal()
  composerStore.cleanup()
  if (dmSubscription) {
    dmSubscription.unsubscribe()
  }
  if (presenceSyncSubscription) {
    presenceSyncSubscription.unsubscribe()
  }
  if (mentionSubscription) {
    mentionSubscription.unsubscribe()
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
    const currentUserIndex = usersWithFullData.value.findIndex((u: UserPresence) => u.userId === user.value!.userId)
    if (currentUserIndex !== -1 && usersWithFullData.value[currentUserIndex]!.status !== 'online') {
      usersWithFullData.value[currentUserIndex]!.status = 'online'
      updateUserPresence(user.value.userId, 'online')
      usersStore.setUserPresence(user.value.userId, 'online')
    }
  }

  // Sync all users to presence store
  usersWithFullData.value.forEach((u: UserPresence) => {
    usersStore.setUserPresence(u.userId, u.status)
  })
}, { deep: true })

// Watch for query param changes to handle highlight navigation
watch(() => [route.query.channel, route.query.highlight], async ([channelIdParam, highlightParam]) => {
  if (channelIdParam && highlightParam) {
    const channelId = Number(channelIdParam)
    const messageId = Number(highlightParam)
    const channel = channels.value.find((ch: typeof channels.value[0]) => ch.id === channelId)

    if (channel) {
      // If we're already on this channel, just highlight the message
      if (selectedChannel.value?.id === channelId) {
        await handleMessageHighlight(channelId, messageId)
      } else {
        // Switch to the channel (selectChannel will handle highlighting)
        await selectChannel(channel)
      }
    }
  }
}, { immediate: false })
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
        @view-screen-share="handleViewScreenShare"
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
              icon="i-lucide-search"
              color="neutral"
              variant="ghost"
              aria-label="Search messages"
              @click="showSearchModal = true"
            />
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

        <!-- Search Modal -->
        <MessageSearch v-model="showSearchModal" />

        <template v-if="selectedChannel?.channelType === 'TEXT'">
          <MessageList
            ref="messageListRef"
            :messages="messages"
            :loading="loading"
            :error="error"
            :has-more="hasMoreMessages"
            :loading-more="loadingMoreMessages"
            :highlight-message-id="highlightMessageId"
            mode="channel"
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

                <UButton
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-image"
                  aria-label="Insert GIF"
                  @click="composerStore.toggleGifPicker()"
                />
              </div>

              <!-- Pickers positioned outside the form to avoid overflow clipping -->
              <Teleport to="body">
                <div
                  v-if="composerStore.showEmojiPicker"
                  ref="emojiPickerContainerRef"
                  class="fixed z-50 bottom-20 left-[340px]"
                >
                  <EmojiPicker @select="addEmoji" />
                </div>
                <div
                  v-if="composerStore.showGifPicker"
                  ref="gifPickerContainerRef"
                  class="fixed z-50 bottom-20 left-[340px]"
                >
                  <GifPicker ref="gifPickerRef" @select="addGif" />
                </div>
              </Teleport>

              <!-- Mention Autocomplete -->
              <div class="relative flex-1">
                <MentionAutocomplete
                  :suggestions="composerStore.mentionSuggestions"
                  :loading="composerStore.mentionLoading"
                  :visible="composerStore.showMentionAutocomplete"
                  @select="handleMentionSelect"
                  @close="composerStore.hideMentions()"
                />
                <UTextarea
                  v-model="composerStore.newMessage"
                  placeholder="Type a message... (use @ to mention)"
                  :rows="1"
                  :maxrows="6"
                  autoresize
                  class="w-full"
                  @input="handleMessageInput"
                  @keydown.enter.exact.prevent="sendMessage"
                  @keydown.escape="composerStore.hideMentions()"
                />
              </div>

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
          @view-screen-share="handleViewScreenShare"
        />
      </div>

      <UserPanel :users="usersWithFullData" />

      <!-- Screen Share Viewer -->
      <ScreenShareViewer
        :screen-share="selectedScreenShare"
        :is-minimized="isScreenShareMinimized"
        @close="handleCloseScreenShare"
        @toggle-minimize="handleToggleMinimizeScreenShare"
      />
    </div>
  </ClientOnly>
</template>
