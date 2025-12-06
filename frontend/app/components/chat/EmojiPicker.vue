<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

interface Props {
  maxHeight?: number
}

const props = withDefaults(defineProps<Props>(), {
  maxHeight: 435
})

const emit = defineEmits<{ (e: 'select', emoji: string): void }>()

const pickerContainer = ref<HTMLDivElement | null>(null)
let picker: any = null

onMounted(async () => {
  if (!pickerContainer.value) return

  // Dynamic import for client-side only (SSR safe)
  const { Picker } = await import('emoji-picker-element')
  
  picker = new Picker({
    locale: 'en',
    dataSource: 'https://cdn.jsdelivr.net/npm/emoji-picker-element-data@^1/en/emojibase/data.json',
    skinToneEmoji: '👋',
  })

  // Style the picker with custom height
  picker.className = 'emoji-picker-light dark:emoji-picker-dark'
  picker.style.height = `${props.maxHeight}px`
  
  // Listen for emoji selection
  picker.addEventListener('emoji-click', (event: any) => {
    emit('select', event.detail.unicode)
  })

  pickerContainer.value.appendChild(picker)
})

onBeforeUnmount(() => {
  if (picker && pickerContainer.value?.contains(picker)) {
    pickerContainer.value.removeChild(picker)
  }
})
</script>

<template>
  <div class="emoji-picker-wrapper">
    <div ref="pickerContainer" class="emoji-picker-container" />
  </div>
</template>

<style>
/* Light theme */
emoji-picker {
  --border-color: rgb(229 231 235);
  --background: white;
  --emoji-size: 1.375rem;
  --input-border-color: rgb(209 213 219);
  --input-font-color: rgb(17 24 39);
  --input-background: white;
  --outline-color: rgb(59 130 246);
  --category-emoji-size: 1.25rem;
  --category-font-color: rgb(55 65 81);
  --button-active-background: rgb(243 244 246);
  --button-hover-background: rgb(249 250 251);
  --indicator-color: rgb(59 130 246);
  --skintone-border-radius: 0.5rem;
  border-radius: 0.5rem;
  border: 1px solid var(--border-color);
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  width: 352px;
  max-height: 100%;
}

/* Dark theme */
.dark emoji-picker {
  --border-color: rgb(55 65 81);
  --background: rgb(31 41 55);
  --emoji-size: 1.375rem;
  --input-border-color: rgb(75 85 99);
  --input-font-color: rgb(229 231 235);
  --input-background: rgb(55 65 81);
  --outline-color: rgb(96 165 250);
  --category-emoji-size: 1.25rem;
  --category-font-color: rgb(209 213 219);
  --button-active-background: rgb(55 65 81);
  --button-hover-background: rgb(75 85 99);
  --indicator-color: rgb(96 165 250);
  --skintone-border-radius: 0.5rem;
}

.emoji-picker-wrapper {
  display: contents;
}

.emoji-picker-container {
  display: flex;
}
</style>
