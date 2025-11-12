import { API_CONFIG } from '../utils/apiConfig'

export interface CreateInviteRequest {
  expiresInHours?: number
}

export interface InviteCreateResponse {
  token: string
  expiresAt: string
  invitationUrl: string
}

export interface InviteValidationResponse {
  valid: boolean
  reason?: string
  expiresAt?: string
}

export interface RegisterWithInviteRequest {
  username: string
  email: string
  password: string
  firstName?: string
  lastName?: string
}

export const inviteApi = {
  async create(request: CreateInviteRequest, token: string): Promise<InviteCreateResponse> {
    const { createAuthFetch } = await import('./authApi')
    const authFetch = createAuthFetch(token)
    return await authFetch<InviteCreateResponse>(API_CONFIG.INVITES.CREATE, {
      method: 'POST',
      body: request
    })
  },

  async validate(token: string): Promise<InviteValidationResponse> {
    return await $fetch<InviteValidationResponse>(`${API_CONFIG.BASE_URL}${API_CONFIG.INVITES.VALIDATE(token)}`)
  },

  async register(token: string, request: RegisterWithInviteRequest): Promise<import('../../shared/types/user').AuthResponse> {
    return await $fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.INVITES.REGISTER(token)}`, {
      method: 'POST',
      body: request
    })
  }
}
