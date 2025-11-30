<script setup lang="ts">
import type { FormSubmitEvent } from '#ui/types'
import { z } from 'zod'

definePageMeta({
  layout: false,
  middleware: 'auth'
})

const loading = ref(false)
const error = ref<string | null>(null)
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
  otp: z.string()
    .length(6, 'Verification code must be 6 digits')
    .regex(/^\d+$/, 'Verification code must contain only numbers')
})

type Schema = z.output<typeof schema>

const state = reactive<Schema>({
  otp: ''
})

const onSubmit = async (event: FormSubmitEvent<Schema>) => {
  loading.value = true
  error.value = null

  try {
    const response = await $fetch<{ success: boolean, message: string }>('/api/auth/password/verify-otp', {
      method: 'POST',
      body: {
        email: email.value,
        otp: event.data.otp
      }
    })

    if (response.success) {
      await navigateTo('/forgot-password/reset')
    } else {
      error.value = response.message || 'Invalid verification code'
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

const resendCode = async () => {
  loading.value = true
  error.value = null

  try {
    const response = await $fetch<{ success: boolean, message: string }>('/api/auth/password/forgot', {
      method: 'POST',
      body: { email: email.value }
    })

    if (response.success) {
      error.value = null
    } else {
      error.value = response.message || 'Failed to resend verification code'
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
              Verify Your Email
            </h1>
            <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Enter the 6-digit code sent to<br>
              <span class="font-medium text-gray-900 dark:text-white">{{ email }}</span>
            </p>
          </div>
        </div>
      </template>

      <UForm
        :state="state"
        :schema="schema"
        class="space-y-8"
        @submit="onSubmit"
      >
        <UFormGroup
          label="Verification Code"
          name="otp"
          required
          :ui="{ label: { base: 'font-semibold text-gray-700 dark:text-gray-200' } }"
        >
          <UInput
            v-model="state.otp"
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            maxlength="6"
            placeholder="Enter 6-digit code"
            icon="i-lucide-key-round"
            size="xl"
            :disabled="loading"
            class="focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 transition-all duration-200 w-full text-center tracking-widest text-lg"
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
          :disabled="state.otp.length !== 6"
          class="font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02] mt-4"
        >
          Verify Code
        </UButton>

        <div class="text-center space-y-2">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Didn't receive the code?
            <button
              type="button"
              :disabled="loading"
              class="text-primary-600 dark:text-primary-400 hover:underline font-medium"
              @click="resendCode"
            >
              Resend
            </button>
          </p>
          <NuxtLink
            to="/forgot-password"
            class="text-sm text-gray-500 dark:text-gray-500 hover:underline block"
          >
            Use a different email
          </NuxtLink>
        </div>
      </UForm>
    </UCard>
  </div>
</template>
