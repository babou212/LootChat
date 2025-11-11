export interface User {
  userId: number
  username: string
  email: string
  firstName?: string
  lastName?: string
  role: string
  avatar?: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface AuthResponse {
  userId: string | number
  token: string
  username: string
  email: string
  role: string
  avatar?: string
  message: string
}
