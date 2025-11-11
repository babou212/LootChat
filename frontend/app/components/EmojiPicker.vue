<script setup lang="ts">
import { ref, computed } from 'vue'

// Simple categorized emoji sets (can be expanded later)
interface EmojiCategory {
  key: string
  label: string
  emojis: string[]
}

const categories: EmojiCategory[] = [
  {
    key: 'smileys',
    label: 'Smileys',
    emojis: ['😀', '😃', '😄', '😁', '😆', '🥹', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '😍', '😘', '😗', '😙', '😚', '😋', '😛', '😜', '🤪', '😝', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😴', '🤤', '🥱', '😮', '😯', '😲', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😎', '🤓', '🧐', '🥳']
  },
  {
    key: 'gestures',
    label: 'Gestures',
    emojis: ['👍', '👎', '🙏', '👏', '🤝', '👊', '🤛', '🤜', '🤞', '✌️', '🤘', '👌', '🤌', '🖖', '✋', '🤚', '🖐️', '🫱', '🫲', '🫸', '🫷', '🫳', '🫴', '👋']
  },
  {
    key: 'animals',
    label: 'Animals',
    emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🐣', '🐺', '🦄']
  },
  {
    key: 'food',
    label: 'Food',
    emojis: ['🍎', '🍊', '🍉', '🍓', '🍒', '🍍', '🥝', '🍅', '🥑', '🍆', '🥕', '🌽', '🥔', '🥐', '🍞', '🧀', '🥚', '🍖', '🍗', '🌭', '🍔', '🍟', '🍕', '🥪', '🥙', '🌮', '🌯', '🥗', '🍣']
  },
  {
    key: 'activity',
    label: 'Activity',
    emojis: ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏓', '🏸', '🥏', '🥅', '⛳', '🏒', '🏑', '🏏', '🥍', '🏹', '🎣', '🥊', '🥋', '🎽', '🛼', '🛹', '⛸️', '🥌', '🎯', '🎱', '🎮', '🕹️', '🎲', '♟️']
  },
  {
    key: 'objects',
    label: 'Objects',
    emojis: ['💡', '🔌', '💻', '🖥️', '⌨️', '🖱️', '📱', '📷', '🎥', '🎧', '📡', '📺', '⏰', '⌚', '🔋', '🔑', '✏️', '🖊️', '📝', '📎', '🗂️', '📁', '📦', '🔒', '🔓']
  },
  {
    key: 'symbols',
    label: 'Symbols',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '⭐', '🌟', '✨', '⚡', '🔥', '💥', '❄️', '💦', '💢', '💣']
  }
]

const activeCategoryKey = ref(categories[0]!.key)

const activeCategory = computed(() => categories.find(c => c.key === activeCategoryKey.value)!)

const emit = defineEmits<{ (e: 'select', emoji: string): void }>()

const selectEmoji = (e: string) => {
  emit('select', e)
}
</script>

<template>
  <div class="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow p-2 w-72">
    <div class="flex flex-wrap gap-1 mb-2">
      <button
        v-for="c in categories"
        :key="c.key"
        type="button"
        class="px-2 py-1 text-xs rounded border"
        :class="c.key === activeCategoryKey ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 border-gray-900 dark:border-gray-100' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600'"
        @click="activeCategoryKey = c.key"
      >
        {{ c.label }}
      </button>
    </div>
    <div class="grid grid-cols-8 gap-1 max-h-48 overflow-auto pr-1 scrollbar-hide">
      <button
        v-for="(e, i) in activeCategory.emojis"
        :key="i"
        type="button"
        class="text-xl hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
        @click="selectEmoji(e)"
      >
        {{ e }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.scrollbar-hide {
  -ms-overflow-style: none;  /* IE and Edge */
  scrollbar-width: none;  /* Firefox */
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;  /* Chrome, Safari and Opera */
}
</style>
