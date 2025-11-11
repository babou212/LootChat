export const API_CONFIG = {
  BASE_URL: process.env.NUXT_PUBLIC_API_URL || 'http://localhost:8080',
  AUTH: {
    LOGIN: '/api/auth/login',
    USER: '/api/auth/user'
  },
  INVITES: {
    CREATE: '/api/invites',
    VALIDATE: (token: string) => `/api/invites/${token}`,
    REGISTER: (token: string) => `/api/invites/${token}/register`
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
    DELETE: (id: number) => `/api/messages/${id}`,
    ADD_REACTION: (messageId: number) => `/api/messages/${messageId}/reactions`,
    REMOVE_REACTION: (messageId: number) => `/api/messages/${messageId}/reactions`
  },
  USERS: {
    ALL: '/api/users',
    BY_ID: (id: number) => `/api/users/${id}`
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

export interface UserResponse {
  id: number
  username: string
  email: string
  firstName?: string
  lastName?: string
  role: string
  avatar?: string
}

export const userApi = {
  async getAllUsers(token: string): Promise<UserResponse[]> {
    const authFetch = createAuthFetch(token)
    return await authFetch<UserResponse[]>(API_CONFIG.USERS.ALL)
  },

  async getUserById(id: number, token: string): Promise<UserResponse> {
    const authFetch = createAuthFetch(token)
    return await authFetch<UserResponse>(API_CONFIG.USERS.BY_ID(id))
  },

  async getUserPresence(token: string): Promise<Record<number, boolean>> {
    const authFetch = createAuthFetch(token)
    return await authFetch<Record<number, boolean>>(`${API_CONFIG.USERS.ALL}/presence`)
  }
}

// Invite API
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
