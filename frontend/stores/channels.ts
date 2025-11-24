import { defineStore } from 'pinia'
import type { Channel } from '../shared/types/chat'

export const useChannelsStore = defineStore('channels', {
  state: () => ({
    channels: [] as Channel[],
    selectedChannel: null as Channel | null,
    loading: false,
    error: null as string | null
  }),

  getters: {
    textChannels: state => state.channels.filter(c => c.channelType === 'TEXT' || !c.channelType),
    voiceChannels: state => state.channels.filter(c => c.channelType === 'VOICE'),

    hasUnreadMessages: state => state.channels.some(c => (c.unread || 0) > 0),

    totalUnreadCount: state => state.channels.reduce((sum, c) => sum + (c.unread || 0), 0),

    getChannelById: (state) => {
      return (channelId: number): Channel | undefined => {
        return state.channels.find(c => c.id === channelId)
      }
    }
  },

  actions: {
    async fetchChannels() {
      this.loading = true
      this.error = null

      try {
        const response = await fetch('/api/channels')
        if (!response.ok) {
          throw new Error('Failed to fetch channels')
        }

        const data = await response.json()
        this.channels = Array.isArray(data) ? data : []
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to fetch channels'
        console.error('Failed to fetch channels:', err)
      } finally {
        this.loading = false
      }
    },

    selectChannel(channel: Channel | null) {
      this.selectedChannel = channel
    },

    async markChannelAsRead(channelId: number) {
      const channel = this.channels.find(c => c.id === channelId)
      if (channel && (channel.unread || 0) > 0) {
        channel.unread = 0

        try {
          await fetch(`/api/channels/${channelId}/read`, {
            method: 'POST'
          })
        } catch (err) {
          console.error('Failed to mark channel as read:', err)
        }
      }
    },

    incrementUnreadCount(channelId: number) {
      const channel = this.channels.find(c => c.id === channelId)
      if (channel && this.selectedChannel?.id !== channelId) {
        channel.unread = (channel.unread || 0) + 1
      }
    },

    updateChannel(channelId: number, updates: Partial<Channel>) {
      const channel = this.channels.find(c => c.id === channelId)
      if (channel) {
        Object.assign(channel, updates)
      }
    },

    addChannel(channel: Channel) {
      const exists = this.channels.some(c => c.id === channel.id)
      if (!exists) {
        this.channels.push(channel)
      }
    },

    removeChannel(channelId: number) {
      const index = this.channels.findIndex(c => c.id === channelId)
      if (index !== -1) {
        this.channels.splice(index, 1)

        if (this.selectedChannel?.id === channelId) {
          this.selectedChannel = null
        }
      }
    },

    clearChannels() {
      this.channels = []
      this.selectedChannel = null
    },

    setError(error: string | null) {
      this.error = error
    }
  }
})
