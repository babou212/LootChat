import { defineStore } from 'pinia'
import type { SoundboardSound } from '../shared/types/soundboard'

interface SoundboardState {
  sounds: SoundboardSound[]
  loading: boolean
  audioCache: Map<string, string>
}

export const useSoundboardStore = defineStore('soundboard', {
  state: (): SoundboardState => ({
    sounds: [],
    loading: false,
    audioCache: new Map()
  }),

  getters: {
    allSounds: state => state.sounds,

    isLoading: state => state.loading,

    getPresignedUrl: state => (fileUrl: string) => {
      return state.audioCache.get(fileUrl)
    }
  },

  actions: {
    async fetchSounds() {
      try {
        this.loading = true
        const sounds = await $fetch<SoundboardSound[]>('/api/soundboard/sounds')
        this.sounds = Array.isArray(sounds)
          ? sounds.map(s => ({
              ...s,
              createdAt: new Date(s.createdAt)
            }))
          : []
      } catch (error) {
        console.error('Failed to fetch soundboard sounds:', error)
        this.sounds = []
        throw error
      } finally {
        this.loading = false
      }
    },

    async uploadSound(name: string, durationMs: number, file: File): Promise<SoundboardSound> {
      const formData = new FormData()
      formData.append('name', name)
      formData.append('durationMs', durationMs.toString())
      formData.append('file', file)

      try {
        const sound = await $fetch<SoundboardSound>('/api/soundboard/sounds', {
          method: 'POST',
          body: formData
        })

        // Fallback: add to state immediately, WebSocket will dedupe if it arrives
        if (sound && sound.id) {
          this.addSound(sound)
        }

        return sound
      } catch (error) {
        console.error('Failed to upload sound:', error)
        throw error
      }
    },

    async deleteSound(soundId: number) {
      try {
        await $fetch(`/api/soundboard/sounds/${soundId}`, {
          method: 'DELETE'
        })

        this.sounds = this.sounds.filter(s => s.id !== soundId)
      } catch (error) {
        console.error('Failed to delete sound:', error)
        throw error
      }
    },

    async playSound(channelId: number, soundId: number) {
      try {
        await $fetch(`/api/soundboard/channels/${channelId}/sounds/${soundId}/play`, {
          method: 'POST'
        })
      } catch (error) {
        console.error('Failed to play sound:', error)
        throw error
      }
    },

    async getAudioUrl(fileUrl: string): Promise<string> {
      // Check cache first
      const cached = this.audioCache.get(fileUrl)
      if (cached) {
        return cached
      }

      try {
        // fileUrl is the full path like "sounds/uuid.mp3"
        // Pass it as a query parameter instead of in the URL path
        const response = await $fetch<{ url: string }>(`/api/soundboard/sounds/url?path=${encodeURIComponent(fileUrl)}`)
        this.audioCache.set(fileUrl, response.url)

        setTimeout(() => {
          this.audioCache.delete(fileUrl)
        }, 50 * 60 * 1000)

        return response.url
      } catch (error) {
        console.error('Failed to get audio URL:', error)
        throw error
      }
    },

    addSound(sound: SoundboardSound) {
      if (!this.sounds.find(s => s.id === sound.id)) {
        this.sounds = [{ ...sound, createdAt: new Date(sound.createdAt) }, ...this.sounds]
      }
    }
  }
})
