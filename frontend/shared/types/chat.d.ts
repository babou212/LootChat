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

export enum WebRTCSignalType {
  OFFER = 'OFFER',
  ANSWER = 'ANSWER',
  ICE_CANDIDATE = 'ICE_CANDIDATE',
  JOIN = 'JOIN',
  LEAVE = 'LEAVE',
  SCREEN_SHARE_START = 'SCREEN_SHARE_START',
  SCREEN_SHARE_STOP = 'SCREEN_SHARE_STOP'
}

export interface WebRTCSignalRequest {
  channelId: number
  type: WebRTCSignalType
  fromUserId: string
  toUserId?: string
  data?: RTCSessionDescriptionInit | RTCIceCandidateInit | Record<string, unknown>
}

export interface WebRTCSignalResponse {
  channelId: number
  type: WebRTCSignalType
  fromUserId: string
  fromUsername: string
  toUserId?: string
  data?: RTCSessionDescriptionInit | RTCIceCandidateInit | Record<string, unknown>
}

export interface VoiceParticipant {
  userId: string
  username: string
  avatar?: string
  isMuted: boolean
  isSpeaking: boolean
  isScreenSharing: boolean
}

export interface ScreenShareInfo {
  sharerId: string
  sharerUsername: string
  stream?: MediaStream
}
