import { API_CONFIG } from './apiConfig'
import { createAuthFetch } from './authApi'

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
}

export interface UpdateMessageRequest {
  content: string
}

export const messageApi = {
  async getAllMessages(token: string, channelId?: number): Promise<MessageResponse[]> {
    const authFetch = createAuthFetch(token)
    const url = channelId
      ? `${API_CONFIG.MESSAGES.ALL}?channelId=${channelId}`
      : API_CONFIG.MESSAGES.ALL
    return await authFetch<MessageResponse[]>(url)
  },

  async getMessageById(id: number, token: string): Promise<MessageResponse> {
    const authFetch = createAuthFetch(token)
    return await authFetch<MessageResponse>(API_CONFIG.MESSAGES.BY_ID(id))
  },

  async getMessagesByUserId(userId: number, token: string): Promise<MessageResponse[]> {
    const authFetch = createAuthFetch(token)
    return await authFetch<MessageResponse[]>(API_CONFIG.MESSAGES.BY_USER(userId))
  },

  async createMessage(request: CreateMessageRequest, token: string): Promise<MessageResponse> {
    const authFetch = createAuthFetch(token)
    return await authFetch<MessageResponse>(API_CONFIG.MESSAGES.CREATE, {
      method: 'POST',
      body: request
    })
  },

  async createMessageWithImage(channelId: number, image: File, content: string | null, token: string): Promise<MessageResponse> {
    const formData = new FormData()
    formData.append('image', image)
    formData.append('channelId', channelId.toString())
    if (content) {
      formData.append('content', content)
    }

    const response = await fetch(`${API_CONFIG.BASE_URL}/api/messages/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    })

    if (!response.ok) {
      throw new Error(`Failed to upload image: ${response.statusText}`)
    }

    return await response.json()
  },

  async updateMessage(id: number, request: UpdateMessageRequest, token: string): Promise<MessageResponse> {
    const authFetch = createAuthFetch(token)
    return await authFetch<MessageResponse>(API_CONFIG.MESSAGES.UPDATE(id), {
      method: 'PUT',
      body: request
    })
  },

  async deleteMessage(id: number, token: string): Promise<void> {
    const authFetch = createAuthFetch(token)
    await authFetch(API_CONFIG.MESSAGES.DELETE(id), {
      method: 'DELETE'
    })
  },

  async addReaction(messageId: number, emoji: string, token: string): Promise<ReactionResponse> {
    const authFetch = createAuthFetch(token)
    return await authFetch<ReactionResponse>(API_CONFIG.MESSAGES.ADD_REACTION(messageId), {
      method: 'POST',
      body: { emoji } as ReactionRequest
    })
  },

  async removeReaction(messageId: number, emoji: string, token: string): Promise<void> {
    const authFetch = createAuthFetch(token)
    await authFetch(API_CONFIG.MESSAGES.REMOVE_REACTION(messageId), {
      method: 'DELETE',
      body: { emoji } as ReactionRequest
    })
  }
}
