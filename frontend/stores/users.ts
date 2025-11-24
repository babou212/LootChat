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
    error: null as string | null
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

    updateUserPresence(userId: number, status: 'online' | 'offline') {
      const user = this.users.find(u => u.userId === userId)
      if (user) {
        user.status = status
      }
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
    },

    clearUsers() {
      this.users = []
    },

    setError(error: string | null) {
      this.error = error
    }
  }
})
