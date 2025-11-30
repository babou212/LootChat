<script setup lang="ts">
import type { FormSubmitEvent } from '#ui/types'
import { z } from 'zod'

definePageMeta({
  layout: false,
  middleware: 'auth'
})

const loading = ref(false)
const error = ref<string | null>(null)
const success = ref(false)
const emailSent = ref('')

const schema = z.object({
  email: z.string()
    .email('Please enter a valid email address')
    .max(255, 'Email is too long')
})

type Schema = z.output<typeof schema>

const state = reactive<Schema>({
  email: ''
})

const onSubmit = async (event: FormSubmitEvent<Schema>) => {
  loading.value = true
  error.value = null

  try {
    const response = await $fetch<{ success: boolean, message: string }>('/api/auth/password/forgot', {
      method: 'POST',
      body: { email: event.data.email }
    })

    if (response.success) {
      emailSent.value = event.data.email
      success.value = true
      sessionStorage.setItem('resetEmail', event.data.email)
      await navigateTo('/forgot-password/verify')
    } else {
      error.value = response.message || 'Failed to send verification code'
    }
  } catch (err: unknown) {
    const errorMessage = err && typeof err === 'object' && 'data' in err
      ? ((err as { data?: { message?: string } }).data?.message || 'An error occurred')
      : 'An error occurred'
    error.value = errorMessage
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12">
    <UCard class="w-full max-w-md">
      <template #header>
        <div class="flex flex-col items-center gap-4">
          <Logo class="h-12 w-auto" />
          <div class="text-center">
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
              Forgot Password?
            </h1>
            <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Enter your email address and we'll send you a verification code
            </p>
          </div>
        </div>
      </template>

      <UForm
        :state="state"
        :schema="schema"
        class="space-y-6"
        @submit="onSubmit"
      >
        <UFormGroup
          label="Email Address"
          name="email"
          required
          :ui="{ label: { base: 'font-semibold text-gray-700 dark:text-gray-200' } }"
        >
          <UInput
            v-model="state.email"
            type="email"
            placeholder="Enter your email address"
            icon="i-lucide-mail"
            size="xl"
            :disabled="loading"
            class="focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 transition-all duration-200 w-full"
          />
        </UFormGroup>

        <div v-if="error" class="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-alert-circle" class="h-4 w-4" />
            <span>{{ error }}</span>
          </div>
        </div>

        <UButton
          type="submit"
          size="xl"
          block
          :loading="loading"
          :disabled="!state.email"
          class="font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02] mt-4"
        >
          Send Verification Code
        </UButton>

        <div class="text-center">
          <NuxtLink
            to="/login"
            class="text-sm text-primary-600 dark:text-primary-400 hover:underline"
          >
            Back to Login
          </NuxtLink>
        </div>
      </UForm>
    </UCard>
  </div>
</template>
