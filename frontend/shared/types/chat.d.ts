export type ChannelType = 'TEXT' | 'VOICE'

export interface Channel {
  id: number
  name: string
  description?: string
  channelType: ChannelType
  unread?: number
  createdAt?: string
  updatedAt?: string
}

export interface Reaction {
  id: number
  emoji: string
  userId: number
  username: string
  messageId?: number
  createdAt: Date
}

export interface Message {
  id: number
  userId: string
  username: string
  content: string
  timestamp: Date
  avatar?: string
  imageUrl?: string
  imageFilename?: string
  channelId?: number
  channelName?: string
  reactions?: Reaction[]
  updatedAt?: Date
  edited?: boolean
  replyToMessageId?: number
  replyToUsername?: string
  replyToContent?: string
  deleted?: boolean
}

export interface VoiceParticipant {
  odod: string
  username: string
  avatar?: string
  isMuted: boolean
  isSpeaking: boolean
  isScreenSharing: boolean
}

export interface ScreenShareInfo {
  odod: string
  sharerUsername: string
  track?: unknown
}
