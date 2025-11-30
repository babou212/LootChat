import { defineStore } from 'pinia'
import type { Channel } from '../shared/types/chat'

export const useChannelsStore = defineStore('channels', {
  state: () => ({
    channels: [] as Channel[],
    selectedChannel: null as Channel | null,
    loading: false,
    error: null as string | null,
    unreadCountsFetched: false
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

        // Fetch unread counts after fetching channels
        await this.fetchUnreadCounts()
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to fetch channels'
        console.error('Failed to fetch channels:', err)
      } finally {
        this.loading = false
      }
    },

    /**
     * Fetch persistent unread counts from the server.
     * This should be called on login/page load to get accurate unread counts
     * for messages received while the user was offline.
     */
    async fetchUnreadCounts() {
      try {
        const response = await fetch('/api/channels/unread')
        if (!response.ok) {
          console.error('Failed to fetch unread counts:', response.status)
          return
        }

        const unreadCounts = await response.json() as Record<string, number>

        // Apply unread counts to channels
        for (const [channelIdStr, count] of Object.entries(unreadCounts)) {
          const channelId = parseInt(channelIdStr, 10)
          const channel = this.channels.find(c => c.id === channelId)
          if (channel) {
            channel.unread = count
          }
        }

        this.unreadCountsFetched = true
      } catch (err) {
        console.error('Failed to fetch unread counts:', err)
      }
    },

    selectChannel(channel: Channel | null) {
      this.selectedChannel = channel
    },

    async markChannelAsRead(channelId: number) {
      const channel = this.channels.find(c => c.id === channelId)
      if (channel) {
        // Always update local state immediately for responsiveness
        const hadUnread = (channel.unread || 0) > 0
        channel.unread = 0

        // Persist to server (always call to update lastReadAt timestamp)
        try {
          await fetch(`/api/channels/${channelId}/read`, {
            method: 'POST'
          })
        } catch (err) {
          console.error('Failed to mark channel as read:', err)
          // Optionally restore the unread count on error
          if (hadUnread) {
            // We don't restore because the user has seen the messages
          }
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
      this.unreadCountsFetched = false
    },

    setError(error: string | null) {
      this.error = error
    },

    /**
     * Reset the unread counts fetched flag.
     * Call this when the user logs out or when you need to refetch counts.
     */
    resetUnreadState() {
      this.unreadCountsFetched = false
      this.channels.forEach((channel) => {
        channel.unread = 0
      })
    }
  }
})
