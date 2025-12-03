import type { Ref } from 'vue'
import { useNotifications } from '../utils/useNotifications'

export interface MentionNotification {
  messageId: number
  channelId: number | null
  channelName: string | null
  senderId: number
  senderUsername: string
  senderAvatar: string | null
  messagePreview: string
  mentionType: 'user' | 'everyone' | 'here'
  targetUserIds: number[]
}

export interface MentionSuggestion {
  name: string
  type: 'user' | 'special'
  description?: string
}

/**
 * Composable for handling @mentions in messages.
 */
export const useMentions = () => {
  const { showMentionNotification, requestPermission, permission } = useNotifications()
  const { user } = useAuth()

  // Mention autocomplete suggestions
  const suggestions: Ref<MentionSuggestion[]> = ref([])
  const isLoadingSuggestions = ref(false)
  const showSuggestions = ref(false)
  const mentionQuery = ref('')

  // Special mention targets
  const specialMentions: MentionSuggestion[] = [
    { name: 'everyone', type: 'special', description: 'Notify all users' },
    { name: 'here', type: 'special', description: 'Notify online users' }
  ]

  /**
   * Fetch user suggestions for autocomplete.
   */
  const fetchSuggestions = async (prefix: string) => {
    isLoadingSuggestions.value = true
    try {
      const response = await $fetch<string[]>('/api/mentions/users/search', {
        params: { prefix }
      })

      // Filter out current user and combine with special mentions
      const userSuggestions: MentionSuggestion[] = response
        .filter(username => username !== user.value?.username)
        .map(username => ({
          name: username,
          type: 'user' as const
        }))

      // Filter special mentions by prefix
      const filteredSpecial = prefix
        ? specialMentions.filter(m => m.name.startsWith(prefix.toLowerCase()))
        : specialMentions

      suggestions.value = [...filteredSpecial, ...userSuggestions].slice(0, 10)
    } catch (error) {
      console.error('Failed to fetch mention suggestions:', error)
      suggestions.value = specialMentions
    } finally {
      isLoadingSuggestions.value = false
    }
  }

  /**
   * Handle mention input - detect @ and trigger autocomplete.
   */
  const handleMentionInput = (content: string, cursorPosition: number) => {
    // Find the word at cursor position
    const beforeCursor = content.slice(0, cursorPosition)
    const mentionMatch = beforeCursor.match(/@(\w*)$/)

    if (mentionMatch && mentionMatch[1] !== undefined) {
      mentionQuery.value = mentionMatch[1]
      showSuggestions.value = true
      fetchSuggestions(mentionMatch[1])
    } else {
      showSuggestions.value = false
      suggestions.value = []
    }
  }

  /**
   * Insert a mention at the current cursor position.
   */
  const insertMention = (content: string, cursorPosition: number, mention: string): string => {
    const beforeCursor = content.slice(0, cursorPosition)
    const afterCursor = content.slice(cursorPosition)

    // Find where the @ starts
    const atIndex = beforeCursor.lastIndexOf('@')
    if (atIndex === -1) return content

    const newContent = beforeCursor.slice(0, atIndex) + '@' + mention + ' ' + afterCursor
    showSuggestions.value = false
    suggestions.value = []

    return newContent
  }

  /**
   * Parse mentions from message content for highlighting.
   */
  const parseMentions = (content: string): { text: string, isMention: boolean, mentionType?: string }[] => {
    const mentionRegex = /@(everyone|here|[a-zA-Z0-9_]+)/g
    const parts: { text: string, isMention: boolean, mentionType?: string }[] = []
    let lastIndex = 0
    let match

    while ((match = mentionRegex.exec(content)) !== null) {
      // Add text before the mention
      if (match.index > lastIndex) {
        parts.push({ text: content.slice(lastIndex, match.index), isMention: false })
      }

      // Determine mention type
      const mentionName = (match[1] ?? '').toLowerCase()
      let mentionType: string
      if (mentionName === 'everyone' || mentionName === 'here') {
        mentionType = 'special'
      } else if (user.value && mentionName === user.value.username.toLowerCase()) {
        mentionType = 'self'
      } else {
        mentionType = 'user'
      }

      // Add the mention
      parts.push({
        text: match[0],
        isMention: true,
        mentionType
      })

      lastIndex = match.index + match[0].length
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push({ text: content.slice(lastIndex), isMention: false })
    }

    return parts.length > 0 ? parts : [{ text: content, isMention: false }]
  }

  /**
   * Check if a message mentions the current user.
   */
  const isUserMentioned = (content: string): boolean => {
    if (!user.value) return false

    const lowerContent = content.toLowerCase()
    const username = user.value.username.toLowerCase()

    // Check for @everyone, @here, or @username
    return lowerContent.includes('@everyone')
      || lowerContent.includes('@here')
      || lowerContent.includes(`@${username}`)
  }

  /**
   * Handle incoming mention notification.
   */
  const handleMentionNotification = (notification: MentionNotification) => {
    console.log('[Mentions] Received notification:', notification)
    console.log('[Mentions] Current user:', user.value)
    console.log('[Mentions] Permission:', permission.value)

    if (!user.value) {
      console.log('[Mentions] No user, skipping')
      return
    }

    // Only show notification if current user is in target list
    if (!notification.targetUserIds.includes(user.value.userId)) {
      console.log('[Mentions] User not in target list, skipping')
      return
    }

    console.log('[Mentions] User is mentioned, showing notification')

    const title = notification.channelName
      ? `${notification.senderUsername} mentioned you in #${notification.channelName}`
      : `${notification.senderUsername} mentioned you`

    // Check if user is actively viewing the app
    const isTabVisible = document.visibilityState === 'visible'
    console.log('[Mentions] Tab visible:', isTabVisible)

    if (isTabVisible) {
      // User is looking at the app - show in-app toast only
      const toast = useToast()
      toast.add({
        title,
        description: notification.messagePreview,
        icon: 'i-lucide-at-sign',
        color: 'info'
      })
    } else {
      // User is not looking at the app - show browser notification
      if (permission.value === 'default') {
        console.log('[Mentions] Requesting permission...')
        requestPermission().then((granted: boolean) => {
          console.log('[Mentions] Permission granted:', granted)
          if (granted) {
            showMentionNotification(
              notification.senderUsername,
              notification.channelName,
              notification.messagePreview
            )
          }
        })
      } else if (permission.value === 'granted') {
        console.log('[Mentions] Permission already granted, showing browser notification')
        showMentionNotification(
          notification.senderUsername,
          notification.channelName,
          notification.messagePreview
        )
      } else {
        console.log('[Mentions] Permission denied')
      }
    }
  }

  return {
    // Autocomplete
    suggestions,
    isLoadingSuggestions,
    showSuggestions,
    mentionQuery,
    handleMentionInput,
    insertMention,
    fetchSuggestions,

    // Parsing & Display
    parseMentions,
    isUserMentioned,

    // Notifications
    handleMentionNotification
  }
}
