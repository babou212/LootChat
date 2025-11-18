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
