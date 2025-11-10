export const API_CONFIG = {
  BASE_URL: process.env.NUXT_PUBLIC_API_URL || 'http://localhost:8080',
  AUTH: {
    LOGIN: '/api/auth/login',
    USER: '/api/auth/user'
  },
  MESSAGES: {
    ALL: '/api/messages',
    BY_ID: (id: number) => `/api/messages/${id}`,
    BY_USER: (userId: number) => `/api/messages/user/${userId}`,
    CREATE: '/api/messages',
    UPDATE: (id: number) => `/api/messages/${id}`,
    DELETE: (id: number) => `/api/messages/${id}`
  }
}

export const createAuthFetch = (token: string) => {
  return $fetch.create({
    baseURL: API_CONFIG.BASE_URL,
    headers: {
      Authorization: `Bearer ${token}`
    }
  })
}

export interface MessageResponse {
  id: number
  content: string
  userId: number
  username: string
  createdAt: string
  updatedAt: string
  avatar: string
}

export interface CreateMessageRequest {
  content: string
  userId: number
}

export interface UpdateMessageRequest {
  content: string
}

export const messageApi = {
  async getAllMessages(token: string): Promise<MessageResponse[]> {
    const authFetch = createAuthFetch(token)
    return await authFetch<MessageResponse[]>(API_CONFIG.MESSAGES.ALL)
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
  }
}
