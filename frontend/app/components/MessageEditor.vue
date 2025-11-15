<script setup lang="ts">
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

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('cancel')
  } else if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    if (editText.value.trim()) {
      emit('save', props.messageId, editText.value.trim())
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
      class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
      rows="3"
      @keydown="handleKeydown"
    />
    <div class="flex gap-2 text-xs text-gray-500 dark:text-gray-400">
      <span>Press <kbd class="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">Enter</kbd> to save</span>
      <span>• <kbd class="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">Esc</kbd> to cancel</span>
    </div>
  </div>
</template>
