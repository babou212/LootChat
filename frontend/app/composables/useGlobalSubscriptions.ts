import type { StompSubscription } from '@stomp/stompjs'
import type { UserPresenceUpdate } from '~/composables/useWebSocket'
import { useMessagesStore } from '../../stores/messages'

export const useGlobalSubscriptions = () => {
  const messagesStore = useMessagesStore()
  const { subscribeToAllMessages, subscribeToUserPresence, subscribeToGlobalMessageDeletions } = useWebSocket()

  let allMessagesSubscription: StompSubscription | null = null
  let userPresenceSubscription: StompSubscription | null = null
  let globalMessageDeletionSubscription: StompSubscription | null = null

  const subscribeToGlobal = (
    onNewMessage: (channelId: number) => void,
    onUserPresenceUpdate: (update: UserPresenceUpdate) => void,
    selectedChannelId: Ref<number | null>
  ) => {
    allMessagesSubscription = subscribeToAllMessages((newMessage) => {
      if (newMessage.channelId && selectedChannelId.value && newMessage.channelId !== selectedChannelId.value) {
        onNewMessage(newMessage.channelId)
      }
    })

    globalMessageDeletionSubscription = subscribeToGlobalMessageDeletions((payload) => {
      if (!payload) return
      if (selectedChannelId.value && payload.channelId === selectedChannelId.value) {
        messagesStore.removeMessage(selectedChannelId.value, payload.id)
      }
    })

    userPresenceSubscription = subscribeToUserPresence(onUserPresenceUpdate)
  }

  const unsubscribeAll = () => {
    if (allMessagesSubscription) {
      allMessagesSubscription.unsubscribe()
      allMessagesSubscription = null
    }
    if (userPresenceSubscription) {
      userPresenceSubscription.unsubscribe()
      userPresenceSubscription = null
    }
    if (globalMessageDeletionSubscription) {
      globalMessageDeletionSubscription.unsubscribe()
      globalMessageDeletionSubscription = null
    }
  }

  return {
    subscribeToGlobal,
    unsubscribeAll
  }
}
