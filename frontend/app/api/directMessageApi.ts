export interface DirectMessageResponse {
  id: number
  otherUserId: number
  otherUsername: string
  otherUserAvatar?: string
  lastMessageContent?: string
  lastMessageAt?: string
  unreadCount: number
  createdAt: string
}

export interface DirectMessageMessageResponse {
  id: number
  content: string
  senderId: number
  senderUsername: string
  senderAvatar?: string
  directMessageId: number
  imageUrl?: string
  imageFilename?: string
  replyToMessageId?: number
  replyToUsername?: string
  replyToContent?: string
  isRead: boolean
  edited?: boolean
  createdAt: string
  updatedAt?: string
  reactions?: Array<{
    id: number
    emoji: string
    userId: number
    username: string
    messageId: number
    createdAt: string
  }>
}

export interface CreateDirectMessageRequest {
  recipientId: number
}

export interface SendDirectMessageRequest {
  content: string
  directMessageId: number
  replyToMessageId?: number
  replyToUsername?: string
  replyToContent?: string
}

export const directMessageApi = {
  async getAllDirectMessages(): Promise<DirectMessageResponse[]> {
    return await $fetch<DirectMessageResponse[]>('/api/direct-messages')
  },

  async createOrGetDirectMessage(recipientId: number): Promise<DirectMessageResponse> {
    return await $fetch<DirectMessageResponse>('/api/direct-messages', {
      method: 'POST',
      body: { recipientId }
    })
  },

  async getMessages(directMessageId: number, page = 0, size = 30): Promise<DirectMessageMessageResponse[]> {
    return await $fetch<DirectMessageMessageResponse[]>(
      `/api/direct-messages/${directMessageId}/messages?page=${page}&size=${size}`
    )
  },

  async sendMessage(request: SendDirectMessageRequest): Promise<DirectMessageMessageResponse> {
    return await $fetch<DirectMessageMessageResponse>('/api/direct-messages/messages', {
      method: 'POST',
      body: request
    })
  },

  async markAsRead(directMessageId: number): Promise<void> {
    await $fetch(`/api/direct-messages/${directMessageId}/mark-read`, {
      method: 'POST'
    })
  },

  async addReaction(messageId: number, emoji: string): Promise<{ id: number, emoji: string, userId: number, username: string, messageId: number, createdAt: string }> {
    return await $fetch(`/api/direct-messages/messages/${messageId}/reactions`, {
      method: 'POST',
      body: { emoji }
    })
  },

  async removeReaction(messageId: number, emoji: string): Promise<void> {
    await $fetch(`/api/direct-messages/messages/${messageId}/reactions`, {
      method: 'DELETE',
      body: { emoji }
    })
  },

  async updateMessage(messageId: number, content: string): Promise<DirectMessageMessageResponse> {
    return await $fetch<DirectMessageMessageResponse>(`/api/direct-messages/messages/${messageId}`, {
      method: 'PUT',
      body: { content }
    })
  },

  async deleteMessage(messageId: number): Promise<void> {
    await $fetch(`/api/direct-messages/messages/${messageId}`, {
      method: 'DELETE'
    })
  }
}
