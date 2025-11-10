export interface Channel {
  id: number
  name: string
  description?: string
  unread?: number
  createdAt?: string
  updatedAt?: string
}

export interface Message {
  id: number
  userId: string
  username: string
  content: string
  timestamp: Date
  avatar?: string
  channelId?: number
  channelName?: string
}
