<script setup lang="ts">
import { z } from 'zod'
import type GifPicker from '~/components/GifPicker.vue'
import type { DirectMessageMessage } from '../../shared/types/directMessage.d'
import { useDirectMessagesStore } from '../../stores/directMessages'
import { useUserPresenceStore } from '../../stores/userPresence'
import { useAvatarStore } from '../../stores/avatars'
import { useComposerStore } from '../../stores/composer'
import type { DirectMessageMessageResponse } from '../../app/api/directMessageApi'

const messageSchema = z.object({
  content: z.string()
    .max(25000, 'Message must be less than 25000 characters')
    .trim()
    .refine(val => val.length > 0, 'Message cannot be only whitespace')
})

definePageMeta({
  middleware: 'auth'
})

const directMessagesStore = useDirectMessagesStore()
const userPresenceStore = useUserPresenceStore()
const avatarStore = useAvatarStore()
const composerStore = useComposerStore()
const { user } = useAuth()
const usersComposable = useUsers()
const users = usersComposable.users
const updateUserPresence = usersComposable.updateUserPresence
const {
  subscribeToUserDirectMessages,
  subscribeToDirectMessageReactions,
  subscribeToDirectMessageReactionRemovals,
  subscribeToDirectMessageEdits,
  subscribeToDirectMessageDeletions,
  subscribeToUserPresence,
  isConnected
} = useWebSocket()
let dmSubscription: ReturnType<typeof subscribeToUserDirectMessages> = null
let reactionSubscription: ReturnType<typeof subscribeToDirectMessageReactions> | null = null
let reactionRemovalSubscription: ReturnType<typeof subscribeToDirectMessageReactionRemovals> | null = null
let editSubscription: ReturnType<typeof subscribeToDirectMessageEdits> | null = null
let deleteSubscription: ReturnType<typeof subscribeToDirectMessageDeletions> | null = null
let presenceSubscription: ReturnType<typeof subscribeToUserPresence> | null = null

const fileInputRef = ref<HTMLInputElement | null>(null)
const gifPickerRef = ref<InstanceType<typeof GifPicker> | null>(null)
const pickerWrapperRef = ref<HTMLElement | null>(null)
const loadingMoreMessages = ref(false)
const PICKER_HEIGHT_ESTIMATE = 420

const hasMoreMessages = computed(() => {
  if (!directMessagesStore.selectedDirectMessageId) return true
  return directMessagesStore.hasMoreMessages(directMessagesStore.selectedDirectMessageId)
})

const currentPage = computed(() => {
  if (!directMessagesStore.selectedDirectMessageId) return 0
  return directMessagesStore.getCurrentPage(directMessagesStore.selectedDirectMessageId)
})

const toggleEmojiPicker = () => {
  composerStore.toggleEmojiPicker()
  if (composerStore.showEmojiPicker) {
    calculatePickerPosition()
  }
}

const toggleGifPicker = () => {
  composerStore.toggleGifPicker()
  if (composerStore.showGifPicker) {
    calculatePickerPosition()
  }
}

const calculatePickerPosition = () => {
  nextTick(() => {
    const wrapper = pickerWrapperRef.value
    if (!wrapper) return

    const wrapperRect = wrapper.getBoundingClientRect()
    const viewportHeight = window.innerHeight

    const spaceBelow = viewportHeight - wrapperRect.bottom
    const spaceAbove = wrapperRect.top

    composerStore.setPickerPosition(spaceBelow < PICKER_HEIGHT_ESTIMATE && spaceAbove > spaceBelow)
  })
}

useClickAway(
  pickerWrapperRef,
  () => {
    composerStore.closePickers()
  },
  { active: computed(() => composerStore.isPickerOpen) }
)

const handleImageSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) return

  if (!file.type.startsWith('image/')) {
    composerStore.setError('Please select an image file')
    return
  }

  if (file.size > 5 * 1024 * 1024) {
    composerStore.setError('Image size must be less than 5MB')
    return
  }

  composerStore.setImage(file)
  composerStore.setError(null)
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

watch(() => composerStore.showGifPicker, (open) => {
  if (!open && gifPickerRef.value) {
    gifPickerRef.value.reset()
  }
})

watch(() => directMessagesStore.directMessages, (dms) => {
  dms.forEach((dm) => {
    if (dm.otherUserAvatar) {
      avatarStore.loadAvatar(dm.otherUserId, dm.otherUserAvatar)
    }

    // Initialize DM user presence as offline, will be updated by presence subscription
    if (userPresenceStore.getUserStatus(dm.otherUserId) === undefined) {
      userPresenceStore.setUserPresence(dm.otherUserId, 'offline')
    }
  })
}, { deep: true, immediate: true })

const getLoadedAvatarUrl = (userId: number): string => {
  return avatarStore.getAvatarUrl(userId) || ''
}

onUnmounted(() => {
  composerStore.cleanup()

  if (dmSubscription) {
    dmSubscription.unsubscribe()
  }
  if (reactionSubscription) {
    reactionSubscription.unsubscribe()
  }
  if (reactionRemovalSubscription) {
    reactionRemovalSubscription.unsubscribe()
  }
  if (editSubscription) {
    editSubscription.unsubscribe()
  }
  if (deleteSubscription) {
    deleteSubscription.unsubscribe()
  }
  if (presenceSubscription) {
    presenceSubscription.unsubscribe()
  }
})

onMounted(async () => {
  await usersComposable.fetchUsers()
  await directMessagesStore.fetchAllDirectMessages()

  // Initialize presence for DM users from the global users list
  directMessagesStore.directMessages.forEach((dm) => {
    const user = users.value.find(u => u.userId === dm.otherUserId)
    if (user) {
      userPresenceStore.setUserPresence(dm.otherUserId, user.status)
    }
  })

  if (directMessagesStore.selectedDirectMessageId) {
    await directMessagesStore.fetchMessages(directMessagesStore.selectedDirectMessageId)
  }

  if (user.value?.userId) {
    // Wait for WebSocket connection (plugin handles auto-connect)
    let attempts = 0
    while (!isConnected.value && attempts < 20) {
      await new Promise(resolve => setTimeout(resolve, 250))
      attempts++
    }

    if (!isConnected.value) {
      console.error('WebSocket not connected - direct messages will not update in real-time')
      return
    }

    presenceSubscription = subscribeToUserPresence((update: { userId: number, status: 'online' | 'offline' }) => {
      updateUserPresence(update.userId, update.status)
      // Also update presence store
      userPresenceStore.updateUserPresence(update)
    })

    dmSubscription = subscribeToUserDirectMessages(user.value.userId, (message: DirectMessageMessageResponse) => {
      const dmMessage = directMessagesStore.convertToDirectMessageMessage(message)
      directMessagesStore.addMessage(message.directMessageId, dmMessage)

      const dm = directMessagesStore.directMessages.find(d => d.id === message.directMessageId)
      if (dm) {
        dm.lastMessageContent = message.content
        dm.lastMessageAt = new Date(message.createdAt)

        if (directMessagesStore.selectedDirectMessageId !== message.directMessageId) {
          dm.unreadCount = (dm.unreadCount || 0) + 1
        }
      }
    })

    // Subscribe to DM reactions, edits, and deletions when DM is selected
    if (directMessagesStore.selectedDirectMessageId) {
      subscribeToRealtimeUpdates(user.value.userId, directMessagesStore.selectedDirectMessageId)
    }
  }
})

const subscribeToRealtimeUpdates = (userId: number, dmId: number) => {
  // Unsubscribe from previous subscriptions
  if (reactionSubscription) {
    reactionSubscription.unsubscribe()
  }
  if (reactionRemovalSubscription) {
    reactionRemovalSubscription.unsubscribe()
  }
  if (editSubscription) {
    editSubscription.unsubscribe()
  }
  if (deleteSubscription) {
    deleteSubscription.unsubscribe()
  }

  // Subscribe to reactions
  reactionSubscription = subscribeToDirectMessageReactions(userId, dmId, (reaction: { id: number, emoji: string, userId: number, username: string, messageId: number, createdAt: string }) => {
    directMessagesStore.addReaction(dmId, reaction.messageId, {
      id: reaction.id,
      emoji: reaction.emoji,
      userId: reaction.userId,
      username: reaction.username,
      messageId: reaction.messageId,
      createdAt: new Date(reaction.createdAt)
    })
  })

  // Subscribe to reaction removals
  reactionRemovalSubscription = subscribeToDirectMessageReactionRemovals(userId, dmId, (reaction: { id: number, messageId: number }) => {
    directMessagesStore.removeReaction(dmId, reaction.messageId, reaction.id)
  })

  // Subscribe to edits
  editSubscription = subscribeToDirectMessageEdits(userId, dmId, (message: DirectMessageMessageResponse) => {
    directMessagesStore.updateMessage(dmId, message.id, {
      content: message.content,
      edited: message.edited || false
    })
  })

  // Subscribe to deletions
  deleteSubscription = subscribeToDirectMessageDeletions(dmId, (payload: { id: number }) => {
    directMessagesStore.removeMessage(dmId, payload.id)
  })
}

const selectDM = async (dmId: number) => {
  directMessagesStore.selectDirectMessage(dmId)
  await directMessagesStore.fetchMessages(dmId)
  await directMessagesStore.markAsRead(dmId)

  // Subscribe to real-time updates for this DM
  if (user.value?.userId) {
    subscribeToRealtimeUpdates(user.value.userId, dmId)
  }
}

const formatTime = (date: Date) => {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`

  return date.toLocaleDateString()
}

const sendMessage = async () => {
  if (!composerStore.hasContent || !directMessagesStore.selectedDirectMessageId || !user.value) return

  const dmId = directMessagesStore.selectedDirectMessageId
  const messageContent = composerStore.newMessage.trim()
  const imageToSend = composerStore.selectedImage
  const replyId = composerStore.replyingTo?.id
  const replyUsername = (composerStore.replyingTo as DirectMessageMessage)?.senderUsername
  const replyContent = composerStore.replyingTo?.content

  // Validate message content if present
  if (messageContent) {
    const validation = messageSchema.safeParse({ content: messageContent })
    if (!validation.success) {
      const errorMessage = validation.error.issues[0]?.message || 'Invalid message'
      composerStore.setError(errorMessage)
      return
    }
  } else if (!imageToSend) {
    // No content and no image
    composerStore.setError('Message cannot be empty')
    return
  }

  try {
    composerStore.setError(null)
    composerStore.setLoading(true)

    const optimisticId = -Date.now()

    if (imageToSend) {
      // Add optimistic message for image upload
      directMessagesStore.addOptimisticMessage(dmId, {
        optimisticId,
        content: messageContent || '',
        senderId: user.value.userId,
        senderUsername: user.value.username,
        senderAvatar: user.value.avatar,
        directMessageId: dmId,
        imageUrl: URL.createObjectURL(imageToSend),
        imageFilename: imageToSend.name,
        replyToMessageId: replyId,
        replyToUsername: replyUsername,
        replyToContent: replyContent,
        isRead: false,
        timestamp: new Date(),
        reactions: []
      })

      const formData = new FormData()
      formData.append('image', imageToSend)
      formData.append('directMessageId', dmId.toString())

      if (replyId) {
        formData.append('replyToMessageId', replyId.toString())
      }
      if (replyUsername) {
        formData.append('replyToUsername', replyUsername)
      }
      if (replyContent) {
        formData.append('replyToContent', replyContent)
      }
      if (messageContent) {
        formData.append('content', messageContent)
      }

      const uploadResponse = await $fetch<DirectMessageMessageResponse>('/api/direct-messages/upload', {
        method: 'POST',
        body: formData
      })

      // Image was uploaded, use the response directly
      directMessagesStore.confirmOptimisticMessage(
        dmId,
        optimisticId,
        directMessagesStore.convertToDirectMessageMessage(uploadResponse)
      )

      composerStore.reset()
      return
    }

    directMessagesStore.addOptimisticMessage(dmId, {
      optimisticId,
      content: messageContent,
      senderId: user.value.userId,
      senderUsername: user.value.username,
      senderAvatar: user.value.avatar,
      directMessageId: dmId,
      replyToMessageId: replyId,
      replyToUsername: replyUsername,
      replyToContent: replyContent,
      isRead: false,
      timestamp: new Date(),
      reactions: []
    })

    composerStore.clearMessage()
    composerStore.cancelReply()

    const response = await $fetch('/api/direct-messages/messages', {
      method: 'POST',
      body: {
        content: messageContent,
        directMessageId: dmId,
        replyToMessageId: replyId,
        replyToUsername: replyUsername,
        replyToContent: replyContent
      }
    })

    if (response) {
      directMessagesStore.confirmOptimisticMessage(
        dmId,
        optimisticId,
        directMessagesStore.convertToDirectMessageMessage(response as DirectMessageMessageResponse)
      )
    }
  } catch (err: unknown) {
    console.error('Failed to send message:', err)
    composerStore.setMessage(messageContent)
    composerStore.setError(err instanceof Error ? err.message : 'Failed to send message')
  } finally {
    composerStore.setLoading(false)
  }
}

const setReplyingTo = (message: DirectMessageMessage) => {
  composerStore.setReplyingTo(message)
}

const cancelReply = () => {
  composerStore.cancelReply()
}

const removeMessageById = (id: number) => {
  if (directMessagesStore.selectedDirectMessageId) {
    directMessagesStore.removeMessage(directMessagesStore.selectedDirectMessageId, id)
  }
}

const loadMoreMessages = async () => {
  if (!hasMoreMessages.value || loadingMoreMessages.value || !directMessagesStore.selectedDirectMessageId) return

  loadingMoreMessages.value = true
  try {
    const page = currentPage.value + 1
    await directMessagesStore.fetchMessages(directMessagesStore.selectedDirectMessageId, page)
  } catch (err) {
    console.error('Failed to load more messages:', err)
  } finally {
    loadingMoreMessages.value = false
  }
}

const isUserOnline = (userId: number): boolean => {
  // First check presence store
  const status = userPresenceStore.getUserStatus(userId)
  if (status !== undefined) {
    return status === 'online'
  }

  // Fallback to global users list
  const foundUser = users.value.find(u => u.userId === userId)
  return foundUser?.status === 'online'
}
</script>

<template>
  <div class="fixed inset-0 flex bg-gray-50 dark:bg-gray-900">
    <div class="w-80 border-r border-gray-200 dark:border-gray-700 flex flex-col bg-white dark:bg-gray-800">
      <div class="h-16 flex items-center px-6 border-b border-gray-200 dark:border-gray-700">
        <div class="flex items-center gap-3 flex-1">
          <NuxtLink
            to="/"
            class="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Back to channels"
          >
            <UIcon name="i-lucide-arrow-left" class="text-lg text-gray-600 dark:text-gray-400" />
          </NuxtLink>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-message-circle" class="text-xl text-gray-600 dark:text-gray-400" />
            <h1 class="text-xl font-semibold text-gray-900 dark:text-white">
              Direct Messages
            </h1>
          </div>
        </div>
      </div>

      <div v-if="directMessagesStore.loading" class="flex-1 flex items-center justify-center">
        <UIcon name="i-lucide-loader-2" class="animate-spin text-2xl text-gray-400 dark:text-gray-500" />
      </div>

      <div v-else-if="directMessagesStore.directMessages.length === 0" class="flex-1 flex items-center justify-center p-6">
        <div class="text-center">
          <UIcon name="i-lucide-message-circle" class="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
          <p class="text-gray-500 dark:text-gray-400 text-sm">
            No direct messages yet.<br>
            Click on a username to start chatting!
          </p>
        </div>
      </div>

      <div v-else class="flex-1 overflow-y-auto">
        <button
          v-for="dm in directMessagesStore.directMessages"
          :key="dm.id"
          type="button"
          class="w-full p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 transition-colors text-left"
          :class="{
            'bg-gray-100 dark:bg-gray-700': directMessagesStore.selectedDirectMessageId === dm.id
          }"
          @click="selectDM(dm.id)"
        >
          <div class="flex items-start gap-3">
            <div class="relative">
              <UAvatar
                :src="getLoadedAvatarUrl(dm.otherUserId)"
                :alt="dm.otherUsername"
                size="md"
              />
              <span
                class="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800"
                :class="isUserOnline(dm.otherUserId) ? 'bg-green-500' : 'bg-gray-400'"
              />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-baseline justify-between">
                <span class="font-semibold text-gray-900 dark:text-white truncate">
                  {{ dm.otherUsername }}
                </span>
                <span v-if="dm.lastMessageAt" class="text-xs text-gray-500 dark:text-gray-400 shrink-0 ml-2">
                  {{ formatTime(dm.lastMessageAt) }}
                </span>
              </div>
              <p v-if="dm.lastMessageContent" class="text-sm text-gray-600 dark:text-gray-400 truncate mt-1">
                {{ dm.lastMessageContent }}
              </p>
              <div v-if="dm.unreadCount > 0" class="mt-1">
                <span class="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white bg-blue-500 rounded-full">
                  {{ dm.unreadCount }}
                </span>
              </div>
            </div>
          </div>
        </button>
      </div>
    </div>

    <div v-if="!directMessagesStore.selectedDirectMessageId" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <UIcon name="i-lucide-message-circle" class="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
        <p class="text-gray-500 dark:text-gray-400 text-lg">
          Select a conversation to start messaging
        </p>
      </div>
    </div>

    <div v-else class="flex-1 flex flex-col min-w-0">
      <div class="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-6">
        <div v-if="directMessagesStore.getSelectedDirectMessage" class="flex items-center gap-3">
          <div class="relative">
            <UAvatar
              :src="getLoadedAvatarUrl(directMessagesStore.getSelectedDirectMessage.otherUserId)"
              :alt="directMessagesStore.getSelectedDirectMessage.otherUsername"
              size="md"
            />
            <span
              class="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800"
              :class="isUserOnline(directMessagesStore.getSelectedDirectMessage.otherUserId) ? 'bg-green-500' : 'bg-gray-400'"
            />
          </div>
          <div>
            <h2 class="font-semibold text-gray-900 dark:text-white">
              {{ directMessagesStore.getSelectedDirectMessage.otherUsername }}
            </h2>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              {{ isUserOnline(directMessagesStore.getSelectedDirectMessage.otherUserId) ? 'Online' : 'Offline' }}
            </p>
          </div>
        </div>
      </div>

      <DirectMessageList
        :messages="directMessagesStore.getMessages(directMessagesStore.selectedDirectMessageId)"
        :loading="false"
        :error="null"
        :has-more="hasMoreMessages"
        :loading-more="loadingMoreMessages"
        @message-deleted="removeMessageById"
        @reply-to-message="setReplyingTo"
        @load-more="loadMoreMessages"
      />

      <div class="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
        <div v-if="composerStore.error" class="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm flex items-start gap-2">
          <UIcon name="i-lucide-alert-circle" class="w-4 h-4 mt-0.5 shrink-0" />
          <span>{{ composerStore.error }}</span>
        </div>

        <div
          v-if="composerStore.replyingTo"
          class="mb-2 p-2 bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500 rounded-r flex items-center justify-between"
        >
          <div class="flex-1">
            <div class="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 mb-1">
              <UIcon name="i-lucide-reply" class="w-3 h-3" />
              <span class="font-semibold">Replying to {{ (composerStore.replyingTo as any).senderUsername }}</span>
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
              @click="toggleEmojiPicker"
            />
            <div
              v-if="composerStore.showEmojiPicker"
              class="absolute left-0 z-100"
              :class="composerStore.openPickerUpwards ? 'bottom-full mb-2' : 'top-full mt-2'"
            >
              <EmojiPicker @select="addEmoji" />
            </div>

            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-image"
              aria-label="Insert GIF"
              @click="toggleGifPicker"
            />
            <div
              v-if="composerStore.showGifPicker"
              class="absolute left-0 z-100"
              :class="composerStore.openPickerUpwards ? 'bottom-full mb-2' : 'top-full mt-2'"
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
            :disabled="!composerStore.hasContent || composerStore.loading || !!composerStore.error"
          >
            Send
          </UButton>
        </form>
      </div>
    </div>
  </div>
</template>
