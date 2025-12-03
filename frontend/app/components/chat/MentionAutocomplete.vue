<script setup lang="ts">
import type { MentionSuggestion } from '../../../stores/composer'

interface Props {
  suggestions: MentionSuggestion[]
  loading: boolean
  visible: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'select', mention: string): void
  (e: 'close'): void
}>()

const selectedIndex = ref(0)

const handleSelect = (suggestion: MentionSuggestion) => {
  emit('select', suggestion.name)
}

// Reset selection when suggestions change
watch(() => props.suggestions, () => {
  selectedIndex.value = 0
})
</script>

<template>
  <Transition
    enter-active-class="transition ease-out duration-100"
    enter-from-class="opacity-0 translate-y-1"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition ease-in duration-75"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 translate-y-1"
  >
    <div
      v-if="visible && (suggestions.length > 0 || loading)"
      class="absolute bottom-full left-0 mb-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-50"
    >
      <div class="px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
        <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Mention
        </span>
      </div>

      <div v-if="loading" class="p-3 text-center">
        <UIcon name="i-lucide-loader-2" class="animate-spin text-gray-400" />
      </div>

      <div v-else class="max-h-48 overflow-y-auto">
        <button
          v-for="(suggestion, index) in suggestions"
          :key="suggestion.name"
          type="button"
          class="w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          :class="{ 'bg-gray-100 dark:bg-gray-700': index === selectedIndex }"
          @click="handleSelect(suggestion)"
        >
          <div
            class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold"
            :class="suggestion.type === 'special'
              ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-600 dark:text-yellow-400'
              : 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'"
          >
            <UIcon
              v-if="suggestion.type === 'special'"
              :name="suggestion.name === 'everyone' ? 'i-lucide-users' : 'i-lucide-radio'"
              class="w-3.5 h-3.5"
            />
            <span v-else>@</span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-medium text-gray-900 dark:text-white truncate">
              @{{ suggestion.name }}
            </div>
            <div v-if="suggestion.description" class="text-xs text-gray-500 dark:text-gray-400 truncate">
              {{ suggestion.description }}
            </div>
          </div>
        </button>
      </div>

      <div v-if="suggestions.length === 0 && !loading" class="p-3 text-center text-sm text-gray-500 dark:text-gray-400">
        No users found
      </div>
    </div>
  </Transition>
</template>
