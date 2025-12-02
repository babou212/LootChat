<script setup lang="ts">
import { useMentions } from '~/composables/useMentions'

interface Props {
  content: string
}

const props = defineProps<Props>()
const { parseMentions } = useMentions()

const parts = computed(() => parseMentions(props.content))
</script>

<template>
  <span>
    <template v-for="(part, index) in parts" :key="index">
      <span
        v-if="part.isMention"
        class="inline-block rounded px-1 font-medium cursor-pointer transition-colors"
        :class="{
          'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800/50': part.mentionType === 'user',
          'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-800/50': part.mentionType === 'special',
          'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 ring-2 ring-green-300 dark:ring-green-700': part.mentionType === 'self'
        }"
        :title="part.mentionType === 'special' ? 'Mentions all users' : part.mentionType === 'self' ? 'You were mentioned!' : 'User mention'"
      >{{ part.text }}</span>
      <span v-else>{{ part.text }}</span>
    </template>
  </span>
</template>
