export interface DirectMessage {
  id: number
  otherUserId: number
  otherUsername: string
  otherUserAvatar?: string
  lastMessageContent?: string
  lastMessageAt?: Date
  unreadCount: number
  createdAt: Date
}

export interface DirectMessageMessage {
  id: number
  content: string
  senderId: number
  senderUsername: string
  senderAvatar?: string
  directMessageId: number
  imageUrl?: string
  imageFilename?: string
  replyToMessageId?: number
  replyToUsername?: string
  replyToContent?: string
  isRead: boolean
  edited?: boolean
  deleted?: boolean
  timestamp: Date
  updatedAt?: Date
  reactions?: DirectMessageReaction[]
}

export interface DirectMessageReaction {
  id: number
  emoji: string
  userId: number
  username: string
  messageId: number
  createdAt: Date
}

export interface Reaction {
  id: number
  emoji: string
  userId: number
  username: string
  createdAt: Date
}
