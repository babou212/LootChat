import { defineStore } from 'pinia'
import type { User } from '../shared/types/user'

interface AuthState {
  user: User | null
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null
  }),
  getters: {
    isAuthenticated: (state: AuthState): boolean => !!state.user
  },
  actions: {
    setUser(user: User) {
      this.user = user
    },
    clear() {
      this.user = null
    }
  }
})
