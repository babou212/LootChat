export interface MessageSearchResult {
  messageId: number
  content: string
  channelId: number
  channelName: string
  userId: number
  username: string
  userAvatar: string | null
  createdAt: string
  edited: boolean
  attachmentUrls: string[] | null
}

export interface MessageSearchResponse {
  results: MessageSearchResult[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}
