import { API_CONFIG } from './apiConfig'

export interface UserResponse {
  id: number
  username: string
  email: string
  firstName?: string
  lastName?: string
  role: string
  avatar?: string
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export const userApi = {
  async getAllUsers(_token: string): Promise<UserResponse[]> {
    return await $fetch<UserResponse[]>(API_CONFIG.USERS.ALL)
  },

  async getUserById(id: number, _token: string): Promise<UserResponse> {
    return await $fetch<UserResponse>(API_CONFIG.USERS.BY_ID(id))
  },

  async getUserPresence(_token: string): Promise<Record<number, boolean>> {
    return await $fetch<Record<number, boolean>>(`${API_CONFIG.USERS.ALL}/presence`)
  },

  async changePassword(request: ChangePasswordRequest, _token: string): Promise<void> {
    await $fetch(`${API_CONFIG.USERS.ALL}/password`, {
      method: 'PUT',
      body: request
    })
  },

  async checkUsername(username: string): Promise<{ exists: boolean }> {
    return await $fetch<{ exists: boolean }>(`/api/users/check-username/${encodeURIComponent(username)}`)
  },

  async checkEmail(email: string): Promise<{ exists: boolean }> {
    return await $fetch<{ exists: boolean }>(`/api/users/check-email/${encodeURIComponent(email)}`)
  }
}
