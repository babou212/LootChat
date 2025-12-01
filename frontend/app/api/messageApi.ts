import { API_CONFIG } from './apiConfig'

export interface MessageResponse {
  id: number
  content: string
  userId: number
  username: string
  createdAt: string
  updatedAt: string
  avatar: string
  imageUrl?: string
  imageFilename?: string
  channelId: number
  channelName: string
  reactions?: ReactionResponse[]
  replyToMessageId?: number
  replyToUsername?: string
  replyToContent?: string
  deleted?: boolean
}

export interface ReactionResponse {
  id: number
  emoji: string
  userId: number
  username: string
  messageId: number
  createdAt: string
}

export interface ReactionRequest {
  emoji: string
}

export interface CreateMessageRequest {
  content: string
  userId: number
  channelId: number
  replyToMessageId?: number
}

export interface UpdateMessageRequest {
  content: string
}

export const messageApi = {
  async getAllMessages(_token: string, channelId?: number, page?: number, size?: number): Promise<MessageResponse[]> {
    // Use Nuxt server proxy endpoint (token managed server-side)
    const params = new URLSearchParams()
    if (channelId !== undefined) {
      params.append('channelId', channelId.toString())
    }
    if (page !== undefined) {
      params.append('page', page.toString())
    }
    if (size !== undefined) {
      params.append('size', size.toString())
    }
    const url = params.toString()
      ? `${API_CONFIG.MESSAGES.ALL}?${params.toString()}`
      : API_CONFIG.MESSAGES.ALL
    return await $fetch<MessageResponse[]>(url)
  },

  async getMessageById(id: number, _token: string): Promise<MessageResponse> {
    return await $fetch<MessageResponse>(API_CONFIG.MESSAGES.BY_ID(id))
  },

  async getMessagesByUserId(userId: number, _token: string): Promise<MessageResponse[]> {
    return await $fetch<MessageResponse[]>(API_CONFIG.MESSAGES.BY_USER(userId))
  },

  async createMessage(request: CreateMessageRequest, _token: string): Promise<MessageResponse> {
    return await $fetch<MessageResponse>(API_CONFIG.MESSAGES.CREATE, {
      method: 'POST',
      body: request
    })
  },

  async createMessageWithImage(channelId: number, image: File, content: string | null, _token: string): Promise<MessageResponse> {
    const formData = new FormData()
    formData.append('image', image)
    formData.append('channelId', channelId.toString())
    if (content) {
      formData.append('content', content)
    }

    return await $fetch<MessageResponse>('/api/messages/upload', {
      method: 'POST',
      body: formData
    })
  },

  async updateMessage(id: number, request: UpdateMessageRequest, _token: string): Promise<MessageResponse> {
    return await $fetch<MessageResponse>(API_CONFIG.MESSAGES.UPDATE(id), {
      method: 'PUT',
      body: request
    })
  },

  async deleteMessage(id: number, _token: string): Promise<void> {
    await $fetch(API_CONFIG.MESSAGES.DELETE(id), {
      method: 'DELETE'
    })
  },

  async addReaction(messageId: number, emoji: string, _token: string): Promise<ReactionResponse> {
    return await $fetch<ReactionResponse>(API_CONFIG.MESSAGES.ADD_REACTION(messageId), {
      method: 'POST',
      body: { emoji } as ReactionRequest
    })
  },

  async removeReaction(messageId: number, emoji: string, _token: string): Promise<void> {
    await $fetch(API_CONFIG.MESSAGES.REMOVE_REACTION(messageId), {
      method: 'DELETE',
      body: { emoji } as ReactionRequest
    })
  }
}
