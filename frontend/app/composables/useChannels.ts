import type { Channel } from '../../shared/types/chat'
import type { ChannelResponse } from '~/api/channelApi'

export const useChannels = () => {
  const channels = ref<Channel[]>([])
  const selectedChannel = ref<Channel | null>(null)
  const { user } = useAuth()

  const convertToChannel = (apiChannel: ChannelResponse): Channel => {
    return {
      id: apiChannel.id,
      name: apiChannel.name,
      description: apiChannel.description,
      channelType: apiChannel.channelType || 'TEXT',
      createdAt: apiChannel.createdAt,
      updatedAt: apiChannel.updatedAt,
      unread: 0
    }
  }

  const fetchChannels = async () => {
    try {
      if (!user.value) {
        return navigateTo('/login')
      }

      const apiChannels = await $fetch<ChannelResponse[]>('/api/channels')
      channels.value = apiChannels.map(convertToChannel)
    } catch (err) {
      console.error('Failed to fetch channels:', err)
      throw new Error('Failed to load channels')
    }
  }

  const markChannelAsRead = (channelId: number) => {
    const channelIndex = channels.value.findIndex(ch => ch.id === channelId)
    if (channelIndex !== -1) {
      channels.value[channelIndex]!.unread = 0
    }
  }

  const incrementUnreadCount = (channelId: number) => {
    const channelIndex = channels.value.findIndex(ch => ch.id === channelId)
    if (channelIndex !== -1) {
      const currentUnread = channels.value[channelIndex]!.unread || 0
      channels.value[channelIndex]!.unread = currentUnread + 1
    }
  }

  return {
    channels,
    selectedChannel,
    fetchChannels,
    markChannelAsRead,
    incrementUnreadCount,
    convertToChannel
  }
}
