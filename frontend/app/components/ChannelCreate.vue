<script setup lang="ts">
import { channelApi } from '~/api/channelApi'
import type { CreateChannelRequest } from '~/api/channelApi'

const props = defineProps<{
  token: string | null
}>()

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
  if (!props.token) return
  if (nameError.value) {
    emit('error', nameError.value)
    return
  }

  loading.value = true
  try {
    const payload: CreateChannelRequest = {
      name: trimmedName.value,
      description: state.description.trim(),
      channelType: state.channelType
    }
    await channelApi.createChannel(payload, props.token)
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

            <UFormGroup label="Type">
              <URadioGroup
                v-model="state.channelType"
                :options="[
                  { label: 'Text', value: 'TEXT' },
                  { label: 'Voice', value: 'VOICE' }
                ]"
              />
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
