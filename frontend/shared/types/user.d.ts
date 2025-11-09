export interface User {
  id: number
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
  token?: string
  username?: string
  email?: string
  role?: string
  message: string
}
