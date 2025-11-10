import { defineStore } from 'pinia'
import type { User } from '../shared/types/user'

interface AuthState {
  user: User | null
  token: string | null
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    token: null
  }),
  getters: {
    isAuthenticated: (state: AuthState): boolean => !!state.user && !!state.token
  },
  actions: {
    setAuth(user: User, token: string) {
      this.user = user
      this.token = token
    },
    clear() {
      this.user = null
      this.token = null
    }
  }
})
