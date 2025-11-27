<script setup lang="ts">
import { z } from 'zod'

const messageSchema = z.object({
  content: z.string()
    .min(1, 'Message cannot be empty')
    .max(2000, 'Message must be less than 2000 characters')
    .trim()
    .refine(val => val.length > 0, 'Message cannot be only whitespace')
})

interface Props {
  messageId: number
  initialContent: string
}

interface Emits {
  (e: 'save', messageId: number, content: string): void
  (e: 'cancel'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const editText = ref(props.initialContent)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const errorMessage = ref<string | null>(null)
const touched = ref(false)

const errorDisplay = computed(() => {
  if (!touched.value) return null

  const trimmed = editText.value.trim()

  if (!trimmed) {
    return 'Message cannot be empty'
  }

  if (trimmed.length > 2000) {
    return 'Message must be less than 2000 characters'
  }

  return null
})

const validateContent = () => {
  touched.value = true
  const validation = messageSchema.safeParse({ content: editText.value })
  if (!validation.success) {
    errorMessage.value = validation.error.issues[0]?.message || 'Invalid message'
    return false
  }
  errorMessage.value = null
  return true
}

watch(editText, () => {
  if (touched.value) {
    // Just mark as touched, computed will handle validation
  }
})

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('cancel')
  } else if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    const trimmed = editText.value.trim()
    if (trimmed) {
      if (validateContent()) {
        emit('save', props.messageId, trimmed)
      }
    } else {
      emit('cancel')
    }
  }
}

onMounted(() => {
  nextTick(() => {
    if (textareaRef.value) {
      textareaRef.value.focus()
      textareaRef.value.select()
    }
  })
})
</script>

<template>
  <div class="space-y-2">
    <textarea
      ref="textareaRef"
      v-model="editText"
      class="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
      :class="errorDisplay ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'"
      rows="3"
      @keydown="handleKeydown"
      @input="touched = true"
    />
    <div v-if="errorDisplay" class="text-sm text-red-500 dark:text-red-400">
      {{ errorDisplay }}
    </div>
    <div class="flex gap-2 text-xs text-gray-500 dark:text-gray-400">
      <span>Press <kbd class="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">Enter</kbd> to save</span>
      <span>• <kbd class="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">Esc</kbd> to cancel</span>
    </div>
  </div>
</template>
