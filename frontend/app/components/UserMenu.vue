<script setup lang="ts">
const { user, logout } = useAuth()
const router = useRouter()

const open = ref(false)

const goProfile = () => {
  open.value = false
  router.push('/profile')
}

const doLogout = () => {
  logout()
  open.value = false
  router.push('/login')
}
</script>

<template>
  <div v-if="user" class="relative">
    <UButton
      color="neutral"
      variant="ghost"
      :label="user.username"
      icon="i-lucide-user-circle"
      class="flex items-center gap-2"
      @click="open = !open"
    />

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
