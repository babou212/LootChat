export interface User {
  userId: number
  username: string
  email: string
  firstName?: string
  lastName?: string
  role: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface AuthResponse {
  userId: number
  token: string
  username: string
  email: string
  role: string
  message: string
}
