import { defineStore } from 'pinia'

interface UserPresence {
  userId: number
  status: 'online' | 'offline'
}

export const useUserPresenceStore = defineStore('userPresence', {
  state: () => ({
    presence: new Map<number, 'online' | 'offline'>()
  }),

  getters: {
    isUserOnline: (state) => {
      return (userId: number): boolean => {
        return state.presence.get(userId) === 'online'
      }
    },

    getUserStatus: (state) => {
      return (userId: number): 'online' | 'offline' | undefined => {
        return state.presence.get(userId)
      }
    },

    getAllPresence: (state) => {
      return state.presence
    }
  },

  actions: {
    setUserPresence(userId: number, status: 'online' | 'offline') {
      this.presence.set(userId, status)
    },

    updateUserPresence(update: UserPresence) {
      this.presence.set(update.userId, update.status)
    },

    removeUserPresence(userId: number) {
      this.presence.delete(userId)
    },

    batchUpdatePresence(users: UserPresence[]) {
      users.forEach((user) => {
        this.presence.set(user.userId, user.status)
      })
    },

    clearPresence() {
      this.presence.clear()
    }
  }
})
