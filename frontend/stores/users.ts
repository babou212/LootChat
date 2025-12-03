import { defineStore } from 'pinia'

export interface User {
  userId: number
  username: string
  status: 'online' | 'offline'
  avatar?: string
}

export const useUsersStore = defineStore('users', {
  state: () => ({
    users: [] as User[],
    loading: false,
    error: null as string | null,
    presence: new Map<number, 'online' | 'offline'>()
  }),

  getters: {
    onlineUsers: state => state.users.filter(u => u.status === 'online'),

    offlineUsers: state => state.users.filter(u => u.status === 'offline'),

    onlineCount: state => state.users.filter(u => u.status === 'online').length,

    getUserById: (state) => {
      return (userId: number): User | undefined => {
        return state.users.find(u => u.userId === userId)
      }
    },

    getUserByUsername: (state) => {
      return (username: string): User | undefined => {
        return state.users.find(u => u.username === username)
      }
    },

    isUserOnline: (state) => {
      return (userId: number): boolean => {
        const presenceStatus = state.presence.get(userId)
        if (presenceStatus !== undefined) return presenceStatus === 'online'
        const user = state.users.find(u => u.userId === userId)
        return user?.status === 'online'
      }
    },

    getUserStatus: (state) => {
      return (userId: number): 'online' | 'offline' | undefined => {
        const presenceStatus = state.presence.get(userId)
        if (presenceStatus !== undefined) return presenceStatus
        const user = state.users.find(u => u.userId === userId)
        return user?.status
      }
    }
  },

  actions: {
    async fetchUsers() {
      this.loading = true
      this.error = null

      try {
        const response = await fetch('/api/users')
        if (!response.ok) {
          throw new Error('Failed to fetch users')
        }

        const data = await response.json()
        this.users = Array.isArray(data) ? data : []
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to fetch users'
        console.error('Failed to fetch users:', err)
      } finally {
        this.loading = false
      }
    },

    setUserPresence(userId: number, status: 'online' | 'offline') {
      this.presence.set(userId, status)
      const user = this.users.find(u => u.userId === userId)
      if (user) {
        user.status = status
      }
    },

    updateUserPresence(userId: number, status: 'online' | 'offline') {
      this.setUserPresence(userId, status)
    },

    batchUpdatePresence(users: Array<{ userId: number, status: 'online' | 'offline' }>) {
      users.forEach((u) => {
        this.setUserPresence(u.userId, u.status)
      })
    },

    clearPresence() {
      this.presence.clear()
    },

    addUser(userId: number, username: string, status: 'online' | 'offline' = 'offline', avatar?: string) {
      const exists = this.users.some(u => u.userId === userId)
      if (!exists) {
        this.users.push({ userId, username, status, avatar })
      }
    },

    updateUser(userId: number, updates: Partial<User>) {
      const user = this.users.find(u => u.userId === userId)
      if (user) {
        Object.assign(user, updates)
      }
    },

    removeUser(userId: number) {
      const index = this.users.findIndex(u => u.userId === userId)
      if (index !== -1) {
        this.users.splice(index, 1)
      }
      this.presence.delete(userId)
    },

    clearUsers() {
      this.users = []
      this.presence.clear()
    },

    setError(error: string | null) {
      this.error = error
    }
  }
})
