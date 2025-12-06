<script setup lang="ts">
import type { Message, Reaction } from '../../../shared/types/chat'
import type { DirectMessageMessage, DirectMessageReaction } from '../../../shared/types/directMessage'
import { useMessageList, type MessageListConfig, type BaseMessage, type BaseReaction } from '~/composables/chat/useMessageList'
import YouTubePlayer from '~/components/media/YouTubePlayer.vue'
import EmojiPicker from '~/components/chat/EmojiPicker.vue'
import MessageEditor from '~/components/chat/MessageEditor.vue'
import UserProfileCard from '~/components/user/UserProfileCard.vue'
import MentionText from '~/components/chat/MentionText.vue'
import { useUsersStore } from '../../../stores/users'
import { useAvatarStore } from '../../../stores/avatars'
import type { UserPresence } from '../../../shared/types/user'

type AnyMessage = Message | DirectMessageMessage
type AnyReaction = Reaction | DirectMessageReaction

interface Props {
  messages: AnyMessage[]
  loading: boolean
  error: string | null
  hasMore?: boolean
  loadingMore?: boolean
  mode: 'channel' | 'direct'
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'message-deleted', id: number): void
  (e: 'load-more'): void
  (e: 'reply-to-message', message: AnyMessage): void
}>()

const usersStore = useUsersStore()
const avatarStore = useAvatarStore()
const messagesContainer = ref<HTMLElement | null>(null)

const config = computed<MessageListConfig>(() => {
  if (props.mode === 'direct') {
    return {
      deleteEndpoint: (id: number) => `/api/direct-messages/messages/${id}`,
      editEndpoint: (id: number) => `/api/direct-messages/messages/${id}`,
      reactionEndpoint: (id: number) => `/api/direct-messages/messages/${id}/reactions`,
      userIdField: 'senderId',
      usernameField: 'senderUsername',
      avatarField: 'senderAvatar',
      showUserProfile: false,
      showMentions: false
    }
  }
  return {
    deleteEndpoint: (id: number) => `/api/messages/${id}`,
    editEndpoint: (id: number) => `/api/messages/${id}`,
    reactionEndpoint: (id: number) => `/api/messages/${id}/reactions`,
    userIdField: 'userId',
    usernameField: 'username',
    avatarField: 'avatar',
    showUserProfile: true,
    showMentions: true
  }
})

const messagesRef = computed(() => props.messages as BaseMessage[])

const {
  virtualizer,
  virtualRows,
  visibleMessages,
  getMessage,
  scrollToBottom,
  scrollToBottomWhenReady,
  scrollToMessage,
  hasInitiallyScrolled,
  isLoadingMore,
  previousScrollHeight,
  scrollAnchorDistance,
  isNearBottom,
  loadImageUrl,
  getLoadedImageUrl,
  getLoadedAvatarUrl,
  activeEmojiPicker,
  emojiPickerRef,
  emojiPickerPosition,
  emojiPickerHeight,
  toggleEmojiPicker,
  closeEmojiPicker,
  handleEmojiSelect,
  groupReactions,
  hasUserReacted,
  handleReactionClick,
  editingMessageId,
  startEdit,
  cancelEdit,
  saveEdit,
  handleDeleteMessage,
  canDelete,
  canEdit,
  isOptimistic,
  expandedImage,
  expandedImageAlt,
  openImageModal,
  closeImageModal,
  firstGifFrom,
  firstYouTubeFrom,
  contentWithoutMedia,
  formatTime,
  authStore
} = useMessageList<BaseMessage, BaseReaction>(
  messagesRef,
  messagesContainer,
  config.value
)

const getMessageUserId = (message: AnyMessage): string | number => {
  if (props.mode === 'direct') {
    return (message as DirectMessageMessage).senderId
  }
  return (message as Message).userId
}

const getMessageUsername = (message: AnyMessage): string => {
  if (props.mode === 'direct') {
    return (message as DirectMessageMessage).senderUsername
  }
  return (message as Message).username
}

const getMessageAvatar = (message: AnyMessage): string | undefined => {
  if (props.mode === 'direct') {
    return (message as DirectMessageMessage).senderAvatar
  }
  return (message as Message).avatar
}

const getMessageReactions = (message: AnyMessage): AnyReaction[] => {
  return (message.reactions || []) as AnyReaction[]
}

watch(() => props.messages, (newMessages) => {
  newMessages.forEach((message) => {
    const avatar = getMessageAvatar(message)
    const userId = getMessageUserId(message)
    if (avatar) {
      avatarStore.loadAvatar(Number(userId), avatar)
    }
    if (message.imageUrl) {
      loadImageUrl(message.imageUrl)
    }
  })
}, { immediate: true, deep: true })

const getUserPresence = (message: Message): UserPresence => {
  const userId = Number.parseInt(message.userId)
  const status = usersStore.getUserStatus(userId)

  return {
    userId,
    username: message.username,
    email: '',
    firstName: '',
    lastName: '',
    avatar: message.avatar,
    status: status || 'offline',
    role: 'USER'
  }
}

const currentContextId = ref<number | null>(null)

watch(() => props.messages[0], (firstMessage, oldFirstMessage) => {
  if (!firstMessage) return

  const newContextId = props.mode === 'channel'
    ? (firstMessage as Message).channelId
    : (firstMessage as DirectMessageMessage).directMessageId

  const oldContextId = oldFirstMessage
    ? (props.mode === 'channel'
        ? (oldFirstMessage as Message).channelId
        : (oldFirstMessage as DirectMessageMessage).directMessageId)
    : null

  if (newContextId && oldContextId && newContextId !== oldContextId) {
    hasInitiallyScrolled.value = false
    previousScrollHeight.value = 0
    currentContextId.value = newContextId
  } else if (newContextId && !currentContextId.value) {
    currentContextId.value = newContextId
  }
}, { flush: 'sync' })

const handleScroll = () => {
  if (activeEmojiPicker.value !== null) {
    closeEmojiPicker()
  }

  const container = messagesContainer.value
  if (!container || !hasInitiallyScrolled.value) return

  const scrollTop = container.scrollTop
  const threshold = 200

  if (
    scrollTop < threshold
    && props.hasMore
    && !props.loadingMore
    && !isLoadingMore.value
  ) {
    previousScrollHeight.value = container.scrollHeight
    isLoadingMore.value = true
    emit('load-more')
    setTimeout(() => {
      isLoadingMore.value = false
    }, 500)
  }
}

watch(() => visibleMessages.value.length, (newLength, oldLength) => {
  if (newLength === 0 && oldLength > 0) {
    hasInitiallyScrolled.value = false
    previousScrollHeight.value = 0
    scrollAnchorDistance.value = 0
    return
  }

  nextTick(() => {
    if (!messagesContainer.value) return
    const container = messagesContainer.value

    if (oldLength === 0 && newLength > 0) {
      scrollToBottomWhenReady()
      hasInitiallyScrolled.value = true
      return
    }

    if (newLength > oldLength && previousScrollHeight.value > 0) {
      const newScrollHeight = container.scrollHeight
      const heightDifference = newScrollHeight - previousScrollHeight.value
      container.scrollTop = container.scrollTop + heightDifference
      previousScrollHeight.value = 0
      scrollAnchorDistance.value = 0
      return
    }

    if (newLength > oldLength && oldLength > 0 && !props.loadingMore) {
      if (isNearBottom()) {
        scrollToBottomWhenReady()
      }
    }
  })
})

watch(() => props.loading, (isLoading, wasLoading) => {
  if (!isLoading && wasLoading && visibleMessages.value.length > 0) {
    scrollToBottomWhenReady()
    hasInitiallyScrolled.value = true
  }
})

const onDeleteMessage = (message: AnyMessage) => {
  handleDeleteMessage(
    message as BaseMessage,
    getMessageUsername(message),
    id => emit('message-deleted', id)
  )
}

const handleReplyClick = (message: AnyMessage) => {
  emit('reply-to-message', message)
}

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && expandedImage.value) {
    closeImageModal()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  if (messagesContainer.value) {
    messagesContainer.value.addEventListener('scroll', handleScroll, { passive: true })
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  if (messagesContainer.value) {
    messagesContainer.value.removeEventListener('scroll', handleScroll)
  }
})

defineExpose({
  scrollToBottom,
  scrollToMessage
})
</script>

<template>
  <div
    ref="messagesContainer"
    class="flex-1 overflow-y-auto p-6 scrollbar-hide"
  >
    <div
      v-if="loading"
      class="h-full"
      aria-busy="true"
      aria-live="polite"
    >
      <div class="space-y-4 animate-pulse" role="status">
        <div
          v-for="i in 8"
          :key="i"
          class="flex gap-4"
        >
          <div class="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700" />
          <div class="flex-1 space-y-2">
            <div class="flex items-baseline gap-2">
              <div class="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
              <div class="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
            <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-11/12" />
            <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-8/12" />
          </div>
        </div>
      </div>
      <span class="sr-only">Loading messages…</span>
    </div>

    <div v-else-if="error" class="flex items-center justify-center h-full">
      <div class="text-red-500">
        {{ error }}
      </div>
    </div>

    <template v-else>
      <div v-if="loadingMore" class="flex items-center justify-center py-4">
        <div class="text-sm text-gray-500 dark:text-gray-400">
          Loading more messages...
        </div>
      </div>

      <div
        :style="{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative'
        }"
      >
        <div
          v-for="virtualRow in virtualRows"
          :key="virtualRow.index"
          :ref="(el) => { if (el) virtualizer.measureElement(el as Element) }"
          :data-index="virtualRow.index"
          :style="{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${virtualRow.start}px)`
          }"
        >
          <template v-if="getMessage(virtualRow.index)">
            <div
              :data-message-id="getMessage(virtualRow.index)!.id"
              class="flex gap-4 group relative p-2 -m-2 rounded-lg mb-4"
              :class="{
                'opacity-60': isOptimistic(getMessage(virtualRow.index)!)
              }"
            >
              <UAvatar
                :src="getLoadedAvatarUrl(getMessageUserId(getMessage(virtualRow.index)! as AnyMessage))"
                :alt="getMessageUsername(getMessage(virtualRow.index)! as AnyMessage)"
                size="md"
              />

              <div class="flex-1 min-w-0">
                <div class="flex items-baseline gap-2 mb-1">
                  <UPopover
                    v-if="mode === 'channel' && getMessageUserId(getMessage(virtualRow.index)! as AnyMessage) !== authStore.user?.userId?.toString()"
                    :popper="{ placement: 'right', offsetDistance: 8 }"
                  >
                    <button
                      class="font-semibold text-gray-900 dark:text-white hover:underline cursor-pointer"
                    >
                      {{ getMessageUsername(getMessage(virtualRow.index)! as AnyMessage) }}
                    </button>
                    <template #content>
                      <UserProfileCard :user="getUserPresence(getMessage(virtualRow.index)! as Message)" />
                    </template>
                  </UPopover>
                  <span
                    v-else
                    class="font-semibold text-gray-900 dark:text-white"
                  >
                    {{ getMessageUsername(getMessage(virtualRow.index)! as AnyMessage) }}
                  </span>

                  <span class="text-xs text-gray-500 dark:text-gray-400">
                    {{ formatTime(getMessage(virtualRow.index)!.timestamp) }}
                  </span>
                  <span v-if="isOptimistic(getMessage(virtualRow.index)!)" class="text-xs text-gray-400 dark:text-gray-500 italic">
                    (sending...)
                  </span>
                  <span v-else-if="getMessage(virtualRow.index)!.edited" class="text-xs text-gray-400 dark:text-gray-500 italic">
                    (edited)
                  </span>
                </div>

                <MessageEditor
                  v-if="editingMessageId === getMessage(virtualRow.index)!.id"
                  :message-id="getMessage(virtualRow.index)!.id"
                  :initial-content="contentWithoutMedia(getMessage(virtualRow.index)!.content) || getMessage(virtualRow.index)!.content"
                  @save="saveEdit"
                  @cancel="cancelEdit"
                />

                <template v-else>
                  <div
                    v-if="getMessage(virtualRow.index)!.replyToMessageId"
                    class="mb-2 pl-3 border-l-2 border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-r p-2 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                    @click="scrollToMessage(getMessage(virtualRow.index)!.replyToMessageId!)"
                  >
                    <div class="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 mb-1">
                      <UIcon name="i-lucide-corner-down-right" class="w-3 h-3" />
                      <span class="font-semibold">{{ getMessage(virtualRow.index)!.replyToUsername }}</span>
                    </div>
                    <p class="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                      {{ getMessage(virtualRow.index)!.replyToContent }}
                    </p>
                  </div>

                  <p class="text-gray-700 dark:text-gray-300 wrap-break-word whitespace-pre-wrap max-w-full">
                    <MentionText
                      v-if="mode === 'channel'"
                      :content="contentWithoutMedia(getMessage(virtualRow.index)!.content) || getMessage(virtualRow.index)!.content"
                    />
                    <template v-else>
                      {{ contentWithoutMedia(getMessage(virtualRow.index)!.content) || getMessage(virtualRow.index)!.content }}
                    </template>
                  </p>
                </template>

                <NuxtImg
                  v-if="getMessage(virtualRow.index)!.imageUrl && getLoadedImageUrl(getMessage(virtualRow.index)!.imageUrl!)"
                  :src="getLoadedImageUrl(getMessage(virtualRow.index)!.imageUrl!)"
                  :alt="getMessage(virtualRow.index)!.imageFilename || 'Uploaded image'"
                  class="mt-2 rounded-lg max-w-md shadow-sm cursor-pointer hover:opacity-90 transition-opacity hover:ring-2 hover:ring-blue-500"
                  loading="lazy"
                  width="448"
                  height="auto"
                  @click="openImageModal(getLoadedImageUrl(getMessage(virtualRow.index)!.imageUrl!), getMessage(virtualRow.index)!.imageFilename || 'Uploaded image')"
                />

                <YouTubePlayer
                  v-if="firstYouTubeFrom(getMessage(virtualRow.index)!.content)"
                  :url="firstYouTubeFrom(getMessage(virtualRow.index)!.content) as string"
                />

                <NuxtImg
                  v-if="firstGifFrom(getMessage(virtualRow.index)!.content)"
                  :src="firstGifFrom(getMessage(virtualRow.index)!.content) as string"
                  alt="gif"
                  class="mt-2 rounded max-w-xs"
                  loading="lazy"
                  width="320"
                  height="auto"
                />

                <!-- Reactions and actions -->
                <div class="flex items-center gap-2 mt-2 flex-wrap">
                  <button
                    v-for="reactionGroup in groupReactions(getMessageReactions(getMessage(virtualRow.index)! as AnyMessage) as BaseReaction[])"
                    :key="reactionGroup.emoji"
                    type="button"
                    class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm transition-colors"
                    :class="hasUserReacted(reactionGroup.userIds)
                      ? 'bg-blue-100 dark:bg-blue-900 border border-blue-300 dark:border-blue-700'
                      : 'bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'"
                    :title="reactionGroup.usernames.join(', ')"
                    :disabled="isOptimistic(getMessage(virtualRow.index)!)"
                    @click="handleReactionClick(getMessage(virtualRow.index)!.id, reactionGroup.emoji)"
                  >
                    <span>{{ reactionGroup.emoji }}</span>
                    <span class="text-xs font-medium">{{ reactionGroup.count }}</span>
                  </button>

                  <!-- Add reaction button -->
                  <div v-if="!isOptimistic(getMessage(virtualRow.index)!)" class="relative">
                    <button
                      type="button"
                      class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors opacity-0 group-hover:opacity-100"
                      :class="{ 'opacity-100': activeEmojiPicker === getMessage(virtualRow.index)!.id }"
                      @click="(e) => toggleEmojiPicker(getMessage(virtualRow.index)!.id, e)"
                    >
                      <span class="text-lg">+</span>
                    </button>
                  </div>

                  <button
                    v-if="canEdit(getMessage(virtualRow.index)!) && editingMessageId !== getMessage(virtualRow.index)!.id && !isOptimistic(getMessage(virtualRow.index)!)"
                    type="button"
                    class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors opacity-0 group-hover:opacity-100"
                    title="Edit message"
                    @click="startEdit(getMessage(virtualRow.index)!)"
                  >
                    <UIcon name="i-lucide-pencil" class="text-gray-600 dark:text-gray-300" />
                  </button>

                  <button
                    v-if="!isOptimistic(getMessage(virtualRow.index)!)"
                    type="button"
                    class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors opacity-0 group-hover:opacity-100"
                    title="Reply to message"
                    @click="handleReplyClick(getMessage(virtualRow.index)! as AnyMessage)"
                  >
                    <UIcon name="i-lucide-reply" class="text-gray-600 dark:text-gray-300" />
                  </button>

                  <button
                    v-if="canDelete(getMessage(virtualRow.index)!) && !isOptimistic(getMessage(virtualRow.index)!)"
                    type="button"
                    class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 hover:bg-red-200 dark:hover:bg-red-800 transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete message"
                    @click="onDeleteMessage(getMessage(virtualRow.index)! as AnyMessage)"
                  >
                    <UIcon name="i-lucide-trash-2" class="text-red-600 dark:text-red-300" />
                  </button>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </template>

    <div class="h-0" />

    <Teleport to="body">
      <!-- Click-away overlay -->
      <div
        v-if="activeEmojiPicker !== null"
        class="fixed inset-0 z-40"
        @click="closeEmojiPicker"
      />
      <!-- Emoji picker -->
      <div
        v-if="activeEmojiPicker !== null"
        ref="emojiPickerRef"
        class="fixed z-50"
        :style="{
          top: `${emojiPickerPosition.top}px`,
          left: `${emojiPickerPosition.left}px`
        }"
      >
        <EmojiPicker :max-height="emojiPickerHeight" @select="(emoji: string) => handleEmojiSelect(activeEmojiPicker!, emoji)" />
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="expandedImage"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4 cursor-zoom-out"
        @click="closeImageModal"
      >
        <button
          aria-label="Close image"
          class="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors z-50"
          @click.stop="closeImageModal"
        >
          <UIcon name="i-lucide-x" class="text-4xl" />
        </button>
        <NuxtImg
          :src="expandedImage"
          :alt="expandedImageAlt || 'Expanded image'"
          class="max-w-full max-h-full object-contain rounded-lg shadow-2xl cursor-default"
          width="1920"
          height="auto"
          @click.stop
        />
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.highlight-message {
  animation: highlight-pulse 2s ease-in-out;
}

@keyframes highlight-pulse {
  0% {
    background-color: rgb(59 130 246 / 0.2);
    box-shadow: 0 0 0 0 rgb(59 130 246 / 0.4), inset 0 0 0 2px rgb(59 130 246 / 0.6);
  }
  50% {
    background-color: rgb(59 130 246 / 0.3);
    box-shadow: 0 0 20px 0 rgb(59 130 246 / 0.3), inset 0 0 0 2px rgb(59 130 246 / 0.8);
  }
  100% {
    background-color: transparent;
    box-shadow: 0 0 0 0 transparent, inset 0 0 0 0 transparent;
  }
}
</style>
