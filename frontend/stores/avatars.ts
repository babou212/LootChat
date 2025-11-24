import { defineStore } from 'pinia'

export const useAvatarStore = defineStore('avatars', {
  state: () => ({
    avatarUrls: new Map<number, string>(),
    loading: new Set<number>()
  }),

  getters: {
    getAvatarUrl: (state) => {
      return (userId: number): string | undefined => {
        return state.avatarUrls.get(userId)
      }
    },

    isLoading: (state) => {
      return (userId: number): boolean => {
        return state.loading.has(userId)
      }
    },

    hasAvatar: (state) => {
      return (userId: number): boolean => {
        return state.avatarUrls.has(userId)
      }
    }
  },

  actions: {
    async loadAvatar(userId: number, avatarPath: string | undefined) {
      if (!avatarPath || this.avatarUrls.has(userId) || this.loading.has(userId)) {
        return
      }

      this.loading.add(userId)

      try {
        const filename = avatarPath.split('/').pop()
        if (!filename) {
          this.loading.delete(userId)
          return
        }

        const response = await fetch(`/api/files/images/${filename}`)
        if (!response.ok) {
          throw new Error(`Failed to fetch avatar: ${response.statusText}`)
        }

        const data = await response.json() as { url: string, fileName: string }
        const url = data.url

        if (url) {
          this.avatarUrls.set(userId, url)
        }
      } catch (error) {
        console.error(`Failed to load avatar for user ${userId}:`, error)
      } finally {
        this.loading.delete(userId)
      }
    },

    async loadAvatars(users: Array<{ userId: number, avatar?: string }>) {
      const promises = users
        .filter(user => user.avatar && !this.avatarUrls.has(user.userId))
        .map(user => this.loadAvatar(user.userId, user.avatar))

      await Promise.all(promises)
    },

    setAvatarUrl(userId: number, url: string) {
      this.avatarUrls.set(userId, url)
    },

    removeAvatar(userId: number) {
      this.avatarUrls.delete(userId)
      this.loading.delete(userId)
    },

    clearAvatars() {
      this.avatarUrls.clear()
      this.loading.clear()
    }
  }
})
