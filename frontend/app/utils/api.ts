// API configuration for LootChat
export const API_CONFIG = {
  BASE_URL: process.env.NUXT_PUBLIC_API_URL || 'http://localhost:8080',
  AUTH: {
    LOGIN: '/api/auth/login',
    USER: '/api/auth/user'
  }
}

// Helper to create authenticated fetch requests
export const createAuthFetch = (token: string) => {
  return $fetch.create({
    baseURL: API_CONFIG.BASE_URL,
    headers: {
      Authorization: `Bearer ${token}`
    }
  })
}
