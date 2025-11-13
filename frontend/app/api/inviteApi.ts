// import { API_CONFIG } from './apiConfig' // no longer needed: using server proxy routes

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
  async create(request: CreateInviteRequest, _token: string): Promise<InviteCreateResponse> {
    // Use server proxy route to include session automatically; token param retained for backward compatibility
    return await $fetch<InviteCreateResponse>('/api/invites', {
      method: 'POST',
      body: request
    })
  },

  async validate(token: string): Promise<InviteValidationResponse> {
    // Route through Nuxt server for consistent headers / CORS
    return await $fetch<InviteValidationResponse>(`/api/invites/${token}`)
  },

  async register(token: string, request: RegisterWithInviteRequest): Promise<import('../../shared/types/user').AuthResponse> {
    // Route through Nuxt server proxy
    return await $fetch(`/api/invites/${token}/register`, {
      method: 'POST',
      body: request
    })
  }
}
