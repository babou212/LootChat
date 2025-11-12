import { API_CONFIG } from './apiConfig'
import { createAuthFetch } from './authApi'

export interface UserResponse {
  id: number
  username: string
  email: string
  firstName?: string
  lastName?: string
  role: string
  avatar?: string
}

export const userApi = {
  async getAllUsers(token: string): Promise<UserResponse[]> {
    const authFetch = createAuthFetch(token)
    return await authFetch<UserResponse[]>(API_CONFIG.USERS.ALL)
  },

  async getUserById(id: number, token: string): Promise<UserResponse> {
    const authFetch = createAuthFetch(token)
    return await authFetch<UserResponse>(API_CONFIG.USERS.BY_ID(id))
  },

  async getUserPresence(token: string): Promise<Record<number, boolean>> {
    const authFetch = createAuthFetch(token)
    return await authFetch<Record<number, boolean>>(`${API_CONFIG.USERS.ALL}/presence`)
  }
}
