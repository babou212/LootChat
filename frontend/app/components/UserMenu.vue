<script setup lang="ts">
const { user, logout } = useAuth()
const router = useRouter()

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)

useClickAway(
  rootRef,
  () => { open.value = false },
  { active: open }
)

const goProfile = () => {
  open.value = false
  router.push('/profile')
}

const doLogout = async () => {
  open.value = false
  await logout()
  await navigateTo('/login', { replace: true })
}

const getInitials = (username: string) => {
  return username.substring(0, 2).toUpperCase()
}
</script>

<template>
  <div v-if="user" ref="rootRef" class="relative">
    <button
      class="flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
      @click="open = !open"
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
          class="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-xs font-semibold"
        >
          {{ getInitials(user.username) }}
        </div>
      </div>
      <span class="text-sm font-medium text-gray-900 dark:text-white">
        {{ user.username }}
      </span>
      <UIcon name="i-lucide-chevron-down" class="text-gray-600 dark:text-gray-400" />
    </button>

    <transition name="fade">
      <div
        v-if="open"
        class="absolute right-0 mt-2 w-48 rounded-md shadow-lg z-50 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-2"
      >
        <button
          class="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
          @click="goProfile"
        >
          <UIcon name="i-lucide-user" />
          Profile
        </button>
        <button
          class="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-2"
          @click="doLogout"
        >
          <UIcon name="i-lucide-log-out" />
          Logout
        </button>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.12s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
