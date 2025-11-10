export interface Channel {
  id: number
  name: string
  unread?: number
}

export interface Message {
  id: number
  userId: string
  username: string
  content: string
  timestamp: Date
  avatar?: string
}
