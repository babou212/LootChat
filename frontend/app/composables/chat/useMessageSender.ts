import type { MessageResponse } from '~/api/messageApi'
import { useMessagesStore } from '../../../stores/messages'

export const useMessageSender = () => {
  const { user } = useAuth()
  const messagesStore = useMessagesStore()

  const sendMessage = async (
    channelId: number,
    messageContent: string,
    imageFile: File | null,
    replyToMessageId?: number,
    replyToUsername?: string,
    replyToContent?: string
  ) => {
    if (!user.value) {
      throw new Error('User not authenticated')
    }

    let optimisticId: number | null = null

    try {
      if (!imageFile && messageContent) {
        optimisticId = -Date.now()
        messagesStore.addOptimisticMessage(channelId, {
          optimisticId,
          userId: user.value.userId.toString(),
          username: user.value.username,
          content: messageContent,
          timestamp: new Date(),
          avatar: user.value.avatar,
          channelId,
          reactions: [],
          replyToMessageId,
          replyToUsername,
          replyToContent
        })
      }

      if (imageFile) {
        const formData = new FormData()
        formData.append('image', imageFile)
        formData.append('channelId', channelId.toString())
        if (messageContent) {
          formData.append('content', messageContent)
        }
        if (replyToMessageId) {
          formData.append('replyToMessageId', replyToMessageId.toString())
        }

        const response = await $fetch<MessageResponse>('/api/messages/upload', {
          method: 'POST',
          body: formData
        })

        messagesStore.addMessage(channelId, messagesStore.convertToMessage(response))
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const requestBody: Record<string, any> = {
          content: messageContent,
          userId: user.value.userId,
          channelId: channelId
        }

        if (replyToMessageId !== undefined && replyToMessageId !== null) {
          requestBody.replyToMessageId = replyToMessageId
        }

        const response = await $fetch<MessageResponse>('/api/messages', {
          method: 'POST',
          body: requestBody
        })

        if (optimisticId) {
          messagesStore.confirmOptimisticMessage(
            channelId,
            optimisticId,
            messagesStore.convertToMessage(response)
          )
        }
      }
    } catch (err: unknown) {
      if (optimisticId) {
        messagesStore.rollbackOptimisticMessage(channelId, optimisticId)
      }

      const errorMessage = err instanceof Error ? err.message : String(err)
      const friendlyError = errorMessage.includes('413')
        ? 'Image file is too large. Maximum size is 50MB.'
        : errorMessage.includes('upload')
          ? 'Failed to upload image. Please try again.'
          : 'Failed to send message. Please try again.'

      throw new Error(friendlyError)
    }
  }

  return {
    sendMessage
  }
}
