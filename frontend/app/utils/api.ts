export const API_CONFIG = {
  BASE_URL: process.env.NUXT_PUBLIC_API_URL || 'http://localhost:8080',
  AUTH: {
    LOGIN: '/api/auth/login',
    USER: '/api/auth/user'
  },
  CHANNELS: {
    ALL: '/api/channels',
    BY_ID: (id: number) => `/api/channels/${id}`,
    BY_NAME: (name: string) => `/api/channels/name/${name}`,
    CREATE: '/api/channels',
    UPDATE: (id: number) => `/api/channels/${id}`,
    DELETE: (id: number) => `/api/channels/${id}`
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
  channelId: number
  channelName: string
}

export interface CreateMessageRequest {
  content: string
  userId: number
  channelId: number
}

export interface UpdateMessageRequest {
  content: string
}

export interface ChannelResponse {
  id: number
  name: string
  description: string
  createdAt: string
  updatedAt: string
}

export interface CreateChannelRequest {
  name: string
  description: string
}

export interface UpdateChannelRequest {
  name?: string
  description?: string
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
