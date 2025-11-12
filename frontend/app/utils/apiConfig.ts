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
