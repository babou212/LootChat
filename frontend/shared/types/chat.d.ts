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
}

export enum WebRTCSignalType {
  OFFER = 'OFFER',
  ANSWER = 'ANSWER',
  ICE_CANDIDATE = 'ICE_CANDIDATE',
  JOIN = 'JOIN',
  LEAVE = 'LEAVE'
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
  isMuted: boolean
  isSpeaking: boolean
}
