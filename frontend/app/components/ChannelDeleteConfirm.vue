<script setup lang="ts">
import { channelApi } from '~/api/channelApi'
import type { Channel } from '../../shared/types/chat'

const props = defineProps<{
  open: boolean
  channel: Channel | null
  token: string | null
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'deleted', channelId: number): void
  (e: 'error', message: string): void
}>()

const loading = ref(false)

const close = () => emit('update:open', false)

const confirm = async () => {
  if (!props.token || !props.channel) return

  const name = props.channel.name.toLowerCase()
  if (name === 'general' || name === 'general-voice') {
    emit('error', 'This channel is protected and cannot be deleted')
    close()
    return
  }

  loading.value = true
  try {
    await channelApi.deleteChannel(props.channel.id, props.token)
    emit('deleted', props.channel.id)
    close()
  } catch {
    emit('error', 'An error has occurred')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div v-if="open && channel" class="fixed inset-0 z-50 flex items-center justify-center">
    <div class="absolute inset-0 bg-black/30" @click="close" />
    <div class="relative w-full max-w-md px-4">
      <UCard>
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-alert-triangle" class="text-error" />
            <h3 class="text-lg font-semibold">
              Confirm Deletion
            </h3>
          </div>
        </template>

        <div class="space-y-4">
          <p class="text-gray-700 dark:text-gray-300">
            Are you sure you want to delete <strong>{{ channel.name }}</strong>?
            This action cannot be undone.
          </p>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton
              variant="ghost"
              color="neutral"
              :disabled="loading"
              @click="close"
            >
              No
            </UButton>
            <UButton
              color="error"
              :loading="loading"
              @click="confirm"
            >
              Yes
            </UButton>
          </div>
        </template>
      </UCard>
    </div>
  </div>
</template>
