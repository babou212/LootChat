import { defineStore } from 'pinia'
import type { Message } from '../shared/types/chat'
import type { DirectMessageMessage } from '../shared/types/directMessage'

export interface MentionSuggestion {
  name: string
  type: 'user' | 'special'
  description?: string
}

export const useComposerStore = defineStore('composer', {
  state: () => ({
    newMessage: '',
    loading: false,
    error: null as string | null,

    // Reply state
    replyingTo: null as Message | DirectMessageMessage | null,

    // Image upload state
    selectedImage: null as File | null,
    imagePreviewUrl: null as string | null,

    // Picker state
    showEmojiPicker: false,
    showGifPicker: false,
    openPickerUpwards: false,

    // Mention autocomplete state
    showMentionAutocomplete: false,
    mentionSuggestions: [] as MentionSuggestion[],
    mentionQuery: '',
    mentionLoading: false,
    cursorPosition: 0
  }),

  getters: {
    hasMessage: state => !!state.newMessage.trim(),
    hasImage: state => !!state.selectedImage,
    hasContent: state => !!state.newMessage.trim() || !!state.selectedImage,
    isReplying: state => !!state.replyingTo,
    isPickerOpen: state => state.showEmojiPicker || state.showGifPicker
  },

  actions: {
    setMessage(message: string) {
      this.newMessage = message
    },

    appendToMessage(text: string) {
      this.newMessage += text
    },

    clearMessage() {
      this.newMessage = ''
    },

    setLoading(loading: boolean) {
      this.loading = loading
    },

    setError(error: string | null) {
      this.error = error
    },

    setReplyingTo(message: Message | DirectMessageMessage | null) {
      this.replyingTo = message
    },

    cancelReply() {
      this.replyingTo = null
    },

    setImage(file: File | null) {
      if (this.imagePreviewUrl) {
        URL.revokeObjectURL(this.imagePreviewUrl)
      }

      this.selectedImage = file

      if (file) {
        this.imagePreviewUrl = URL.createObjectURL(file)
      } else {
        this.imagePreviewUrl = null
      }
    },

    removeImage() {
      if (this.imagePreviewUrl) {
        URL.revokeObjectURL(this.imagePreviewUrl)
      }

      this.selectedImage = null
      this.imagePreviewUrl = null
    },

    toggleEmojiPicker() {
      this.showEmojiPicker = !this.showEmojiPicker
      this.showGifPicker = false
    },

    toggleGifPicker() {
      this.showGifPicker = !this.showGifPicker
      this.showEmojiPicker = false
    },

    closePickers() {
      this.showEmojiPicker = false
      this.showGifPicker = false
    },

    setPickerPosition(upwards: boolean) {
      this.openPickerUpwards = upwards
    },

    addEmoji(emoji: string) {
      this.newMessage += emoji
      this.showEmojiPicker = false
    },

    addGif(gifUrl: string) {
      this.newMessage += `\n${gifUrl}`
      this.showGifPicker = false
    },

    // Mention autocomplete actions
    setMentionSuggestions(suggestions: MentionSuggestion[]) {
      this.mentionSuggestions = suggestions
    },

    setMentionQuery(query: string) {
      this.mentionQuery = query
    },

    setMentionLoading(loading: boolean) {
      this.mentionLoading = loading
    },

    setCursorPosition(position: number) {
      this.cursorPosition = position
    },

    showMentions() {
      this.showMentionAutocomplete = true
      this.closePickers()
    },

    hideMentions() {
      this.showMentionAutocomplete = false
      this.mentionSuggestions = []
      this.mentionQuery = ''
    },

    insertMention(mention: string) {
      const beforeCursor = this.newMessage.slice(0, this.cursorPosition)
      const afterCursor = this.newMessage.slice(this.cursorPosition)

      // Find where the @ starts
      const atIndex = beforeCursor.lastIndexOf('@')
      if (atIndex === -1) return

      this.newMessage = beforeCursor.slice(0, atIndex) + '@' + mention + ' ' + afterCursor
      this.hideMentions()
    },

    reset() {
      this.clearMessage()
      this.cancelReply()
      this.removeImage()
      this.closePickers()
      this.hideMentions()
      this.setError(null)
      this.setLoading(false)
    },

    cleanup() {
      if (this.imagePreviewUrl) {
        URL.revokeObjectURL(this.imagePreviewUrl)
      }
    }
  }
})
