import { useAuth } from '~/composables/useAuth'

export default defineNuxtPlugin(async () => {
  const { fetchCurrentUser } = useAuth()

  // Try to restore authentication on app load
  if (import.meta.client) {
    const token = localStorage.getItem('auth_token')
    if (token) {
      await fetchCurrentUser()
    }
  }
})
