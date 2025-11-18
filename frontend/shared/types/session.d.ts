/**
 * Session type definitions for nuxt-auth-utils
 * Extends the session interface to include our custom user data and JWT token
 */
declare module '#auth-utils' {
  interface User {
    userId: number
    username: string
    email: string
    role: string
    avatar?: string
  }

  interface UserSession {
    user: User
    token: string
    loggedInAt: Date
    expiresAt?: Date
  }
}

export {}
