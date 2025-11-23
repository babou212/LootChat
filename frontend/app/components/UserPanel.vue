<script setup lang="ts">
import type { User } from '../../shared/types/user'

export interface UserPresence extends User {
  status: 'online' | 'offline'
  avatar?: string
}

interface Props {
  users: UserPresence[]
}

const props = defineProps<Props>()
const { getAvatarUrl } = useAvatarUrl()

const isCollapsed = ref(false)
const avatarUrls = ref<Map<number, string>>(new Map())

const onlineUsers = computed(() =>
  props.users.filter(user => user.status === 'online')
    .sort((a, b) => a.username.localeCompare(b.username))
)

const offlineUsers = computed(() =>
  props.users.filter(user => user.status === 'offline')
    .sort((a, b) => a.username.localeCompare(b.username))
)

const getInitials = (user: UserPresence) => {
  if (user.firstName && user.lastName) {
    return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
  }
  return user.username.substring(0, 2).toUpperCase()
}

const loadAvatarUrl = async (user: UserPresence) => {
  if (user.avatar && !avatarUrls.value.has(user.userId)) {
    const url = await getAvatarUrl(user.avatar)
    if (url) {
      avatarUrls.value.set(user.userId, url)
    }
  }
}

const getLoadedAvatarUrl = (userId: number): string => {
  return avatarUrls.value.get(userId) || ''
}

// Load avatar URLs for all users
watch(() => props.users, (newUsers) => {
  newUsers.forEach((user) => {
    if (user.avatar) {
      loadAvatarUrl(user)
    }
  })
}, { immediate: true, deep: true })
</script>

<template>
  <div
    class="bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300"
    :class="isCollapsed ? 'w-12' : 'w-64'"
  >
    <div class="h-16 border-b border-gray-200 dark:border-gray-700 flex items-center px-4">
      <button
        :aria-label="isCollapsed ? 'Expand user panel' : 'Collapse user panel'"
        class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors ml-auto"
        @click="isCollapsed = !isCollapsed"
      >
        <UIcon
          :name="isCollapsed ? 'i-lucide-chevron-left' : 'i-lucide-chevron-right'"
          class="text-xl text-gray-600 dark:text-gray-400"
        />
      </button>
    </div>

    <div v-if="!isCollapsed" class="flex-1 overflow-y-auto p-2">
      <div class="mb-4">
        <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase px-2 mb-2 flex items-center gap-2">
          <span class="w-2 h-2 bg-green-500 rounded-full" />
          Online — {{ onlineUsers.length }}
        </h3>
        <div class="space-y-1">
          <div
            v-for="user in onlineUsers"
            :key="user.userId"
            class="flex items-center gap-3 px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer"
            :title="`${user.username} - ${user.email}`"
          >
            <div class="relative">
              <div
                v-if="user.avatar && getLoadedAvatarUrl(user.userId)"
                class="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 overflow-hidden"
              >
                <img :src="getLoadedAvatarUrl(user.userId)" :alt="user.username" class="w-full h-full object-cover">
              </div>
              <div
                v-else
                class="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-xs font-semibold"
              >
                {{ getInitials(user) }}
              </div>
              <span class="absolute bottom-0 right-0 w-3 h-3 bg-gray-400 rounded-full border-2 border-white dark:border-gray-800" />
            </div>
            <span class="text-sm font-medium text-gray-900 dark:text-white truncate">
              {{ user.username }}
            </span>
          </div>
        </div>
      </div>

      <div v-if="offlineUsers.length > 0">
        <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase px-2 mb-2 flex items-center gap-2">
          <span class="w-2 h-2 bg-gray-400 rounded-full" />
          Offline — {{ offlineUsers.length }}
        </h3>
        <div class="space-y-1">
          <div
            v-for="user in offlineUsers"
            :key="user.userId"
            class="flex items-center gap-3 px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer opacity-60"
            :title="`${user.username} - ${user.email}`"
          >
            <div class="relative">
              <div
                v-if="user.avatar"
                class="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 overflow-hidden"
              >
                <img :src="user.avatar" :alt="user.username" class="w-full h-full object-cover">
              </div>
              <div
                v-else
                class="w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs font-semibold"
              >
                {{ getInitials(user) }}
              </div>
              <span class="absolute bottom-0 right-0 w-3 h-3 bg-gray-400 rounded-full border-2 border-white dark:border-gray-800" />
            </div>
            <span class="text-sm font-medium text-gray-900 dark:text-white truncate">
              {{ user.username }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="flex-1 flex flex-col items-center pt-4 gap-4">
      <div class="relative">
        <UIcon name="i-lucide-users" class="text-2xl text-gray-600 dark:text-gray-400" />
        <UBadge
          v-if="onlineUsers.length > 0"
          color="success"
          :label="onlineUsers.length.toString()"
          size="xs"
          class="absolute -top-1 -right-1"
        />
      </div>
    </div>
  </div>
</template>
