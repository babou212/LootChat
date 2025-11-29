import type { StompSubscription } from '@stomp/stompjs'
import type { Channel } from '../../shared/types/chat'
import { useMessagesStore } from '../../stores/messages'

export const useChannelSubscriptions = () => {
  const messagesStore = useMessagesStore()
  const { subscribeToChannel, subscribeToChannelReactions, subscribeToChannelReactionRemovals, subscribeToChannelMessageDeletions } = useWebSocket()

  let channelSubscription: StompSubscription | null = null
  let reactionSubscription: StompSubscription | null = null
  let reactionRemovalSubscription: StompSubscription | null = null
  let messageDeletionSubscription: StompSubscription | null = null

  const subscribeToChannelUpdates = async (channel: Channel, _token: string) => {
    unsubscribeAll()

    channelSubscription = subscribeToChannel(channel.id, (newMessage) => {
      messagesStore.addMessage(channel.id, messagesStore.convertToMessage(newMessage))
    })

    if (!channelSubscription) {
      console.warn('Failed to subscribe to channel messages - WebSocket may not be connected')
      return
    }

    reactionSubscription = subscribeToChannelReactions(channel.id, (reaction) => {
      if (reaction.messageId) {
        messagesStore.addReaction(channel.id, reaction.messageId, {
          id: reaction.id,
          emoji: reaction.emoji,
          userId: reaction.userId,
          username: reaction.username,
          createdAt: new Date(reaction.createdAt)
        })
      }
    })

    reactionRemovalSubscription = subscribeToChannelReactionRemovals(channel.id, (reaction) => {
      if (reaction.messageId) {
        messagesStore.removeReaction(channel.id, reaction.messageId, reaction.id)
      }
    })

    messageDeletionSubscription = subscribeToChannelMessageDeletions(channel.id, (payload) => {
      if (payload && typeof payload.id === 'number') {
        // Soft delete: mark as deleted instead of removing
        // This preserves reply chain context
        messagesStore.markAsDeleted(channel.id, payload.id)
      }
    })
  }

  const unsubscribeAll = () => {
    if (channelSubscription) {
      channelSubscription.unsubscribe()
      channelSubscription = null
    }
    if (reactionSubscription) {
      reactionSubscription.unsubscribe()
      reactionSubscription = null
    }
    if (reactionRemovalSubscription) {
      reactionRemovalSubscription.unsubscribe()
      reactionRemovalSubscription = null
    }
    if (messageDeletionSubscription) {
      messageDeletionSubscription.unsubscribe()
      messageDeletionSubscription = null
    }
  }

  return {
    subscribeToChannelUpdates,
    unsubscribeAll
  }
}
