import { useWebSocketStore } from '../../stores/websocket'
import { storeToRefs } from 'pinia'
import type { MessageResponse } from '~/api/messageApi'
import type { DirectMessageMessageResponse } from '~/api/directMessageApi'
import type { Reaction } from '~/../../shared/types/chat'

/**
 * Improved WebSocket Composable
 *
 * Provides a clean interface to interact with the WebSocket store
 * All state is managed centrally in Pinia store
 */

export interface UserPresenceUpdate {
  userId: number
  username: string
  status: 'online' | 'offline'
}

interface MessageDeletionPayload {
  id: number
  channelId?: number | null
}

export const useWebSocket = () => {
  const store = useWebSocketStore()
  const { connectionError } = storeToRefs(store)

  const isConnected = computed(() => store.isConnected)

  /**
   * Subscribe to channel messages
   */
  const subscribeToChannel = (
    channelId: number,
    callback: (message: MessageResponse) => void
  ) => {
    return store.subscribe<MessageResponse>(
      `channel-${channelId}`,
      `/topic/channels/${channelId}/messages`,
      callback
    )
  }

  /**
   * Subscribe to all messages (global feed)
   */
  const subscribeToAllMessages = (callback: (message: MessageResponse) => void) => {
    return store.subscribe<MessageResponse>(
      'all-messages',
      '/topic/messages',
      callback
    )
  }

  /**
   * Subscribe to user presence updates
   */
  const subscribeToUserPresence = (callback: (update: UserPresenceUpdate) => void) => {
    return store.subscribe<UserPresenceUpdate>(
      'user-presence',
      '/topic/user-presence',
      callback
    )
  }

  /**
   * Subscribe to reactions (global)
   */
  const subscribeToReactions = (callback: (reaction: Reaction) => void) => {
    return store.subscribe<Reaction>(
      'reactions',
      '/topic/reactions',
      callback
    )
  }

  /**
   * Subscribe to reaction removals (global)
   */
  const subscribeToReactionRemovals = (callback: (reaction: Reaction) => void) => {
    return store.subscribe<Reaction>(
      'reactions-remove',
      '/topic/reactions/remove',
      callback
    )
  }

  /**
   * Subscribe to channel-specific reactions
   */
  const subscribeToChannelReactions = (
    channelId: number,
    callback: (reaction: Reaction) => void
  ) => {
    return store.subscribe<Reaction>(
      `channel-${channelId}-reactions`,
      `/topic/channels/${channelId}/reactions`,
      callback
    )
  }

  /**
   * Subscribe to channel-specific reaction removals
   */
  const subscribeToChannelReactionRemovals = (
    channelId: number,
    callback: (reaction: Reaction) => void
  ) => {
    return store.subscribe<Reaction>(
      `channel-${channelId}-reactions-remove`,
      `/topic/channels/${channelId}/reactions/remove`,
      callback
    )
  }

  /**
   * Subscribe to global message deletions
   */
  const subscribeToGlobalMessageDeletions = (
    callback: (payload: MessageDeletionPayload) => void
  ) => {
    return store.subscribe<MessageDeletionPayload>(
      'messages-delete',
      '/topic/messages/delete',
      callback
    )
  }

  /**
   * Subscribe to channel message deletions
   */
  const subscribeToChannelMessageDeletions = (
    channelId: number,
    callback: (payload: MessageDeletionPayload) => void
  ) => {
    return store.subscribe<MessageDeletionPayload>(
      `channel-${channelId}-messages-delete`,
      `/topic/channels/${channelId}/messages/delete`,
      callback
    )
  }

  /**
   * Subscribe to user's direct messages
   */
  const subscribeToUserDirectMessages = (
    userId: number,
    callback: (message: DirectMessageMessageResponse) => void
  ) => {
    return store.subscribe<DirectMessageMessageResponse>(
      `user-${userId}-dm`,
      `/topic/user/${userId}/direct-messages`,
      callback
    )
  }

  /**
   * Subscribe to direct message reactions
   */
  const subscribeToDirectMessageReactions = (
    userId: number,
    directMessageId: number,
    callback: (reaction: {
      id: number
      emoji: string
      userId: number
      username: string
      messageId: number
      createdAt: string
    }) => void
  ) => {
    return store.subscribe(
      `user-${userId}-dm-${directMessageId}-reactions`,
      `/topic/user/${userId}/direct-messages/${directMessageId}/reactions`,
      callback
    )
  }

  /**
   * Subscribe to direct message reaction removals
   */
  const subscribeToDirectMessageReactionRemovals = (
    userId: number,
    directMessageId: number,
    callback: (reaction: { id: number, messageId: number }) => void
  ) => {
    return store.subscribe(
      `user-${userId}-dm-${directMessageId}-reactions-remove`,
      `/topic/user/${userId}/direct-messages/${directMessageId}/reactions/remove`,
      callback
    )
  }

  /**
   * Subscribe to direct message edits
   */
  const subscribeToDirectMessageEdits = (
    userId: number,
    directMessageId: number,
    callback: (message: DirectMessageMessageResponse) => void
  ) => {
    return store.subscribe<DirectMessageMessageResponse>(
      `user-${userId}-dm-${directMessageId}-edits`,
      `/topic/user/${userId}/direct-messages/${directMessageId}/edits`,
      callback
    )
  }

  /**
   * Subscribe to direct message deletions
   */
  const subscribeToDirectMessageDeletions = (
    directMessageId: number,
    callback: (payload: { id: number }) => void
  ) => {
    return store.subscribe<{ id: number }>(
      `dm-${directMessageId}-delete`,
      `/topic/direct-messages/${directMessageId}/delete`,
      callback
    )
  }

  /**
   * Unsubscribe from a specific subscription by ID
   */
  const unsubscribe = (subscriptionId: string) => {
    store.unsubscribe(subscriptionId)
  }

  /**
   * Unsubscribe from all channel-related subscriptions
   */
  const unsubscribeFromChannel = (channelId: number) => {
    store.unsubscribe(`channel-${channelId}`)
    store.unsubscribe(`channel-${channelId}-reactions`)
    store.unsubscribe(`channel-${channelId}-reactions-remove`)
    store.unsubscribe(`channel-${channelId}-messages-delete`)
  }

  return {
    // Connection management
    connect: store.connect,
    disconnect: store.disconnect,
    reconnect: store.reconnect,
    refreshToken: store.refreshToken,

    // Subscription methods
    subscribe: store.subscribe,
    unsubscribe,
    unsubscribeAll: store.unsubscribeAll,
    unsubscribeFromChannel,

    // Convenience subscription methods
    subscribeToChannel,
    subscribeToAllMessages,
    subscribeToUserPresence,
    subscribeToReactions,
    subscribeToReactionRemovals,
    subscribeToChannelReactions,
    subscribeToChannelReactionRemovals,
    subscribeToGlobalMessageDeletions,
    subscribeToChannelMessageDeletions,
    subscribeToUserDirectMessages,
    subscribeToDirectMessageReactions,
    subscribeToDirectMessageReactionRemovals,
    subscribeToDirectMessageEdits,
    subscribeToDirectMessageDeletions,

    // Messaging
    sendMessage: store.sendMessage,

    // Reactive state
    isConnected,
    connectionError,

    // For backward compatibility with old composable
    getClient: () => store.client
  }
}
