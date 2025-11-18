import { useAuthStore } from '../../stores/auth'

/**
 * Initialize authentication on app startup
 * nuxt-auth-utils automatically handles session restoration,
 * but we call restore() to ensure any custom logic is executed
 * Also sync the session user to the auth store for compatibility
 */
export default defineNuxtPlugin(async () => {
  const { restore, user } = useAuth()
  const authStore = useAuthStore()

  await restore()

  if (user.value) {
    authStore.setUser(user.value)
  }

  watch(user, (newUser) => {
    if (newUser) {
      authStore.setUser(newUser)
    } else {
      authStore.clear()
    }
  })
})
