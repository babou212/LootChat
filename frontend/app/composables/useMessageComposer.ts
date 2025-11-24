import type { Message } from '../../shared/types/chat'

export const useMessageComposer = () => {
  const newMessage = ref('')
  const selectedImage = ref<File | null>(null)
  const imagePreviewUrl = ref<string | null>(null)
  const fileInputRef = ref<HTMLInputElement | null>(null)
  const showEmojiPicker = ref(false)
  const showGifPicker = ref(false)
  const replyingTo = ref<Message | null>(null)

  const handleImageSelect = (event: Event) => {
    const target = event.target as HTMLInputElement
    const file = target.files?.[0]
    if (file) {
      const maxSizeInMB = 50
      const fileSizeInMB = file.size / (1024 * 1024)

      if (fileSizeInMB > maxSizeInMB) {
        if (fileInputRef.value) {
          fileInputRef.value.value = ''
        }
        throw new Error(`File size (${fileSizeInMB.toFixed(2)}MB) exceeds maximum limit of ${maxSizeInMB}MB`)
      }

      if (!file.type.startsWith('image/')) {
        if (fileInputRef.value) {
          fileInputRef.value.value = ''
        }
        throw new Error('Please select an image file')
      }
      selectedImage.value = file
      imagePreviewUrl.value = URL.createObjectURL(file)
    }
  }

  const removeImage = () => {
    if (imagePreviewUrl.value) {
      URL.revokeObjectURL(imagePreviewUrl.value)
    }
    selectedImage.value = null
    imagePreviewUrl.value = null
    if (fileInputRef.value) {
      fileInputRef.value.value = ''
    }
  }

  const addEmoji = (emoji: string) => {
    newMessage.value += (newMessage.value && !newMessage.value.endsWith(' ') ? ' ' : '') + emoji
    showEmojiPicker.value = false
  }

  const addGif = (gifUrl: string) => {
    const spacer = newMessage.value && !newMessage.value.endsWith(' ') ? ' ' : ''
    newMessage.value = `${newMessage.value}${spacer}${gifUrl}`.trim()
    showGifPicker.value = false
  }

  const setReplyingTo = (message: Message | null) => {
    replyingTo.value = message
  }

  const cancelReply = () => {
    replyingTo.value = null
  }

  const reset = () => {
    newMessage.value = ''
    removeImage()
    replyingTo.value = null
  }

  const cleanup = () => {
    if (imagePreviewUrl.value) {
      URL.revokeObjectURL(imagePreviewUrl.value)
    }
  }

  return {
    newMessage,
    selectedImage,
    imagePreviewUrl,
    fileInputRef,
    showEmojiPicker,
    showGifPicker,
    replyingTo,
    handleImageSelect,
    removeImage,
    addEmoji,
    addGif,
    setReplyingTo,
    cancelReply,
    reset,
    cleanup
  }
}
