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
const email = ref('')

onMounted(() => {
  const storedEmail = sessionStorage.getItem('resetEmail')
  if (!storedEmail) {
    navigateTo('/forgot-password')
    return
  }
  email.value = storedEmail
})

const schema = z.object({
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(255, 'Password is too long'),
  confirmPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords don\'t match',
  path: ['confirmPassword']
})

type Schema = z.output<typeof schema>

const state = reactive<Schema>({
  password: '',
  confirmPassword: ''
})

const onSubmit = async (event: FormSubmitEvent<Schema>) => {
  loading.value = true
  error.value = null

  try {
    const response = await $fetch<{ success: boolean, message: string }>('/api/auth/password/reset', {
      method: 'POST',
      body: {
        email: email.value,
        newPassword: event.data.password
      }
    })

    if (response.success) {
      success.value = true
      sessionStorage.removeItem('resetEmail')
      setTimeout(() => {
        navigateTo('/login')
      }, 2000)
    } else {
      error.value = response.message || 'Failed to reset password'
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
              Create New Password
            </h1>
            <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Enter your new password below
            </p>
          </div>
        </div>
      </template>

      <div v-if="success" class="text-center py-6">
        <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
          <UIcon name="i-lucide-check" class="h-6 w-6 text-green-600 dark:text-green-400" />
        </div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Password Reset Successful!
        </h3>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Redirecting you to login...
        </p>
      </div>

      <UForm
        v-else
        :state="state"
        :schema="schema"
        class="space-y-8"
        @submit="onSubmit"
      >
        <UFormGroup
          label="New Password"
          name="password"
          required
          :ui="{ label: { base: 'font-semibold text-gray-700 dark:text-gray-200' } }"
        >
          <UInput
            v-model="state.password"
            type="password"
            placeholder="Enter your new password"
            icon="i-lucide-lock"
            size="xl"
            :disabled="loading"
            class="focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 transition-all duration-200 w-full"
          />
        </UFormGroup>

        <UFormGroup
          label="Confirm Password"
          name="confirmPassword"
          required
          :ui="{ label: { base: 'font-semibold text-gray-700 dark:text-gray-200' } }"
        >
          <UInput
            v-model="state.confirmPassword"
            type="password"
            placeholder="Confirm your new password"
            icon="i-lucide-lock"
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
          :disabled="!state.password || !state.confirmPassword"
          class="font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02] mt-4"
        >
          Reset Password
        </UButton>

        <div class="text-center">
          <NuxtLink
            to="/login"
            class="text-sm text-gray-500 dark:text-gray-500 hover:underline"
          >
            Back to Login
          </NuxtLink>
        </div>
      </UForm>
    </UCard>
  </div>
</template>
