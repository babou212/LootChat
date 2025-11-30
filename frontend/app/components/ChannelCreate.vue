<script setup lang="ts">
import { z } from 'zod'
import type { CreateChannelRequest } from '~/api/channelApi'

const channelSchema = z.object({
  name: z.string()
    .min(3, 'Channel name must be at least 3 characters')
    .max(50, 'Channel name must be less than 50 characters')
    .trim()
    .refine(val => val.length > 0, 'Channel name cannot be only whitespace'),
  description: z.string()
    .max(200, 'Description must be less than 200 characters')
    .trim()
    .optional()
})

const emit = defineEmits<{
  (e: 'created'): void
  (e: 'error', message: string): void
}>()

const open = defineModel<boolean>('open', { required: false, default: false })

const loading = ref(false)
const state = reactive<{
  name: string
  description: string
  channelType: 'TEXT' | 'VOICE'
}>({
  name: '',
  description: '',
  channelType: 'TEXT'
})

const minNameLength = 3
const trimmedName = computed(() => state.name.trim())
const nameError = computed(() => {
  if (!trimmedName.value) return 'Channel name is required'
  if (trimmedName.value.length < minNameLength) return `Name must be at least ${minNameLength} characters`
  return ''
})

const reset = () => {
  state.name = ''
  state.description = ''
  state.channelType = 'TEXT'
}

const close = () => {
  open.value = false
}

const submit = async () => {
  const validation = channelSchema.safeParse({
    name: state.name.trim(),
    description: state.description.trim()
  })

  if (!validation.success) {
    emit('error', validation.error.issues[0]?.message || 'Invalid channel data')
    return
  }

  loading.value = true
  try {
    const payload: CreateChannelRequest = {
      name: validation.data.name,
      description: validation.data.description || '',
      channelType: state.channelType
    }
    await $fetch('/api/channels', {
      method: 'POST',
      body: payload
    })
    emit('created')
    reset()
    close()
  } catch {
    emit('error', 'An error has occurred')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <UButton icon="i-lucide-plus" color="primary" @click="open = true">
      New Channel
    </UButton>

    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/30" @click="close" />
      <div class="relative w-full max-w-lg px-4">
        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold">
              Create Channel
            </h3>
          </template>

          <div class="space-y-5">
            <UFormGroup label="Name" required>
              <UInput
                v-model="state.name"
                placeholder="e.g. general"
                :disabled="loading"
                size="lg"
                icon="i-lucide-hash"
                autocomplete="off"
                :aria-invalid="!!nameError"
                class="w-full"
              />
              <div class="mt-1 h-5">
                <span v-if="nameError" class="text-sm text-red-600 dark:text-red-400">
                  {{ nameError }}
                </span>
              </div>
            </UFormGroup>

            <UFormGroup label="Description">
              <UTextarea
                v-model="state.description"
                placeholder="Optional description"
                size="lg"
                :rows="3"
                class="w-full resize-none"
              />
            </UFormGroup>

            <UFormGroup label="Type" required>
              <div class="flex gap-4 pt-2">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input
                    v-model="state.channelType"
                    type="radio"
                    value="TEXT"
                    class="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  >
                  <div class="flex items-center gap-2">
                    <UIcon name="i-lucide-hash" class="text-gray-600 dark:text-gray-400" />
                    <span class="text-sm font-medium text-gray-900 dark:text-gray-100">Text Channel</span>
                  </div>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input
                    v-model="state.channelType"
                    type="radio"
                    value="VOICE"
                    class="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  >
                  <div class="flex items-center gap-2">
                    <UIcon name="i-lucide-mic" class="text-gray-600 dark:text-gray-400" />
                    <span class="text-sm font-medium text-gray-900 dark:text-gray-100">Voice Channel</span>
                  </div>
                </label>
              </div>
            </UFormGroup>
          </div>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton
                variant="ghost"
                color="neutral"
                :disabled="loading"
                @click="close"
              >
                Cancel
              </UButton>
              <UButton
                color="primary"
                :loading="loading"
                :disabled="!!nameError"
                @click="submit"
              >
                Create
              </UButton>
            </div>
          </template>
        </UCard>
      </div>
    </div>
  </div>
</template>
