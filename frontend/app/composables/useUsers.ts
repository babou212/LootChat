import type { UserResponse } from '~/api/userApi'
import type { UserPresence } from '~/components/UserPanel.vue'
import type { User } from '../../shared/types/user'
import { useAuthStore } from '../../stores/auth'

export const useUsers = () => {
  const users = ref<UserPresence[]>([])
  const { user } = useAuth()
  const authStore = useAuthStore()

  const fetchUsers = async () => {
    try {
      if (!user.value) {
        return navigateTo('/login')
      }

      const apiUsers = await $fetch<UserResponse[]>('/api/users')

      let presenceMap: Record<number, boolean> = {}
      try {
        presenceMap = await $fetch<Record<number, boolean>>('/api/users/presence')
      } catch {
        // ignore errors for now
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

      if (user.value && user.value.userId) {
        const currentUserIndex = users.value.findIndex(u => u.userId === user.value!.userId)
        if (currentUserIndex !== -1) {
          users.value[currentUserIndex]!.status = 'online'

          const currentUserData = users.value[currentUserIndex]
          if (currentUserData && currentUserData.avatar && !user.value.avatar) {
            const updatedUser: User = { ...user.value, avatar: currentUserData.avatar }
            authStore.setUser(updatedUser)
          }
        } else {
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
    } catch {
      // ignore errors for now
    }
  }

  const updateUserPresence = (userId: number, status: 'online' | 'offline') => {
    const userIndex = users.value.findIndex(u => u.userId === userId)
    if (userIndex !== -1) {
      if (user.value && userId === user.value.userId) {
        users.value[userIndex]!.status = 'online'
      } else {
        users.value[userIndex]!.status = status
      }
    }
  }

  const addUser = (userId: number, username: string, status: 'online' | 'offline') => {
    const exists = users.value.some(u => u.userId === userId)
    if (!exists) {
      users.value.push({
        userId,
        username,
        email: '',
        role: 'USER',
        status
      })
    }
  }

  return {
    users,
    fetchUsers,
    updateUserPresence,
    addUser
  }
}
