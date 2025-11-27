<script setup lang="ts">
import type { User } from '../../shared/types/user'
import { directMessageApi } from '../api/directMessageApi'
import EmojiPicker from '~/components/EmojiPicker.vue'
import { useAvatarStore } from '../../stores/avatars'

export interface UserPresence extends User {
  status: 'online' | 'offline'
  avatar?: string
}

interface Props {
  user: UserPresence
}

const props = defineProps<Props>()
const avatarStore = useAvatarStore()

const messageInput = ref('')
const showEmojiPicker = ref(false)
const emojiPickerRef = ref<HTMLElement | null>(null)

const getInitials = (user: UserPresence) => {
  if (user.firstName && user.lastName) {
    return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
  }
  return user.username.substring(0, 2).toUpperCase()
}

const getAvatarUrl = (): string => {
  return avatarStore.getAvatarUrl(props.user.userId) || ''
}

watch(() => props.user.avatar, (newAvatar) => {
  if (newAvatar) {
    avatarStore.loadAvatar(props.user.userId, newAvatar)
  }
}, { immediate: true })

const emit = defineEmits<{
  (e: 'close'): void
}>()

const sendDirectMessage = async () => {
  if (!messageInput.value.trim()) return

  try {
    // First, create or get the DM conversation
    const dm = await directMessageApi.createOrGetDirectMessage(props.user.userId)

    // Then send the message
    await directMessageApi.sendMessage({
      content: messageInput.value.trim(),
      directMessageId: dm.id
    })

    messageInput.value = ''
    showEmojiPicker.value = false
    emit('close')

    await navigateTo('/messages')

    const { useDirectMessagesStore } = await import('../../stores/directMessages')
    const directMessagesStore = useDirectMessagesStore()

    await directMessagesStore.fetchAllDirectMessages()

    setTimeout(async () => {
      directMessagesStore.selectDirectMessage(dm.id)
      await directMessagesStore.fetchMessages(dm.id)
    }, 100)
  } catch (error) {
    console.error('Failed to send message:', error)
  }
}

const toggleEmojiPicker = () => {
  showEmojiPicker.value = !showEmojiPicker.value
}

const handleEmojiSelect = (emoji: string) => {
  messageInput.value += emoji
  showEmojiPicker.value = false
}

const closeEmojiPicker = () => {
  showEmojiPicker.value = false
}

useClickAway(emojiPickerRef, closeEmojiPicker)
</script>

<template>
  <div class="w-80 bg-gray-900 rounded-lg shadow-2xl overflow-visible">
    <!-- Banner Background -->
    <div
      class="h-16 bg-linear-to-br"
      :class="user.status === 'online' ? 'from-green-600 to-emerald-700' : 'from-gray-700 to-gray-800'"
    />

    <div class="px-4 pb-4">
      <!-- Avatar overlapping banner -->
      <div class="relative -mt-10 mb-3">
        <div class="relative inline-block">
          <div
            v-if="user.avatar && getAvatarUrl()"
            class="w-20 h-20 rounded-full bg-gray-700 border-[6px] border-gray-900 overflow-hidden"
          >
            <img :src="getAvatarUrl()" :alt="user.username" class="w-full h-full object-cover">
          </div>
          <div
            v-else
            class="w-20 h-20 rounded-full border-[6px] border-gray-900 flex items-center justify-center text-white text-2xl font-semibold"
            :class="user.status === 'online' ? 'bg-primary-500' : 'bg-gray-500'"
          >
            {{ getInitials(user) }}
          </div>
          <span
            class="absolute bottom-1 right-1 w-5 h-5 rounded-full border-[3px] border-gray-900"
            :class="user.status === 'online' ? 'bg-green-500' : 'bg-gray-500'"
          />
        </div>
      </div>

      <!-- User Info -->
      <div class="mb-4">
        <h3 class="text-xl font-bold text-white mb-0.5">
          {{ user.username }}
        </h3>
        <p class="text-sm text-gray-400">
          {{ user.email }}
        </p>
      </div>

      <!-- Divider -->
      <div class="h-px bg-gray-800 mb-4" />

      <!-- Status Section -->
      <div class="mb-4">
        <div class="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase mb-2">
          <UIcon
            name="i-lucide-circle"
            class="w-3 h-3"
            :class="user.status === 'online' ? 'text-green-500' : 'text-gray-500'"
          />
          {{ user.status === 'online' ? 'Online' : 'Offline' }}
        </div>
      </div>

      <!-- Message Input -->
      <div class="relative">
        <input
          v-model="messageInput"
          type="text"
          :placeholder="`Message @${user.username}`"
          class="w-full px-3 py-2 pr-20 bg-gray-800 text-gray-200 text-sm rounded border border-gray-700 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 placeholder-gray-500"
          @keydown.enter="sendDirectMessage"
        >
        <div class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <button
            type="button"
            class="p-1 hover:bg-gray-700 rounded transition-colors"
            @click="toggleEmojiPicker"
          >
            <UIcon name="i-lucide-smile" class="w-5 h-5 text-gray-400" />
          </button>
          <button
            v-if="messageInput.trim()"
            type="button"
            class="p-1 hover:bg-gray-700 rounded transition-colors"
            @click="sendDirectMessage"
          >
            <UIcon name="i-lucide-send" class="w-5 h-5 text-primary-500" />
          </button>
        </div>

        <!-- Emoji Picker -->
        <div
          v-if="showEmojiPicker"
          ref="emojiPickerRef"
          class="absolute bottom-full right-0 mb-2 z-50"
        >
          <EmojiPicker @select="handleEmojiSelect" />
        </div>
      </div>
    </div>
  </div>
</template>
