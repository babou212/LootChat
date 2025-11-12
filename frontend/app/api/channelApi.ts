import { API_CONFIG } from './apiConfig'
import { createAuthFetch } from './authApi'

export interface ChannelResponse {
  id: number
  name: string
  description: string
  channelType: 'TEXT' | 'VOICE'
  createdAt: string
  updatedAt: string
}

export interface CreateChannelRequest {
  name: string
  description: string
  channelType?: 'TEXT' | 'VOICE'
}

export interface UpdateChannelRequest {
  name?: string
  description?: string
  channelType?: 'TEXT' | 'VOICE'
}

export const channelApi = {
  async getAllChannels(token: string): Promise<ChannelResponse[]> {
    const authFetch = createAuthFetch(token)
    return await authFetch<ChannelResponse[]>(API_CONFIG.CHANNELS.ALL)
  },

  async getChannelById(id: number, token: string): Promise<ChannelResponse> {
    const authFetch = createAuthFetch(token)
    return await authFetch<ChannelResponse>(API_CONFIG.CHANNELS.BY_ID(id))
  },

  async getChannelByName(name: string, token: string): Promise<ChannelResponse> {
    const authFetch = createAuthFetch(token)
    return await authFetch<ChannelResponse>(API_CONFIG.CHANNELS.BY_NAME(name))
  },

  async createChannel(request: CreateChannelRequest, token: string): Promise<ChannelResponse> {
    const authFetch = createAuthFetch(token)
    return await authFetch<ChannelResponse>(API_CONFIG.CHANNELS.CREATE, {
      method: 'POST',
      body: request
    })
  },

  async updateChannel(id: number, request: UpdateChannelRequest, token: string): Promise<ChannelResponse> {
    const authFetch = createAuthFetch(token)
    return await authFetch<ChannelResponse>(API_CONFIG.CHANNELS.UPDATE(id), {
      method: 'PUT',
      body: request
    })
  },

  async deleteChannel(id: number, token: string): Promise<void> {
    const authFetch = createAuthFetch(token)
    await authFetch(API_CONFIG.CHANNELS.DELETE(id), {
      method: 'DELETE'
    })
  }
}
