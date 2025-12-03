<script setup lang="ts">
import { z } from 'zod'

const passwordSchema = z.object({
  currentPassword: z.string().min(12, 'Current password must be at least 12 characters'),
  newPassword: z.string()
    .min(12, 'Password must be at least 12 characters long')
    .max(100, 'Password must be less than 100 characters')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/\d/, 'Password must contain at least one number')
    .regex(/[!@#$%^&*()_+=[\]{};':"\\|,.<>?-]/, 'Password must contain at least one special character'),
  confirmPassword: z.string().min(1, 'Please confirm your password')
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
})

const state = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const passwordLoading = ref(false)
const serverError = ref<string | null>(null)

const currentPasswordError = computed(() => {
  if (!state.currentPassword) return 'Current password is required'
  if (state.currentPassword.length < 12) return 'Current password must be at least 12 characters'
  return null
})

const newPasswordError = computed(() => {
  if (!state.newPassword) return 'New password is required'
  if (state.newPassword.length < 12) return 'Password must be at least 12 characters long'
  if (state.newPassword.length > 100) return 'Password must be less than 100 characters'
  if (!/[a-z]/.test(state.newPassword)) return 'Password must contain at least one lowercase letter'
  if (!/[A-Z]/.test(state.newPassword)) return 'Password must contain at least one uppercase letter'
  if (!/\d/.test(state.newPassword)) return 'Password must contain at least one number'
  if (!/[!@#$%^&*()_+=[\]{};':"\\|,.<>?-]/.test(state.newPassword)) return 'Password must contain at least one special character'
  if (state.currentPassword && state.newPassword === state.currentPassword) return 'New password must be different from current password'
  return null
})

const confirmPasswordError = computed(() => {
  if (!state.confirmPassword) return 'Please confirm your password'
  if (state.newPassword !== state.confirmPassword) return 'Passwords do not match'
  return null
})

const hasErrors = computed(() => {
  return !!currentPasswordError.value || !!newPasswordError.value || !!confirmPasswordError.value
})

const onSubmit = async () => {
  const validation = passwordSchema.safeParse(state)

  if (!validation.success) {
    return
  }

  passwordLoading.value = true
  serverError.value = null

  try {
    const response = await fetch('/api/users/password', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        oldPassword: state.currentPassword,
        newPassword: state.newPassword
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))

      // Extract validation errors if present
      if (errorData.data && Array.isArray(errorData.data)) {
        const validationErrors = errorData.data.map((issue: { message: string }) => issue.message).join(', ')
        serverError.value = validationErrors
      } else {
        serverError.value = errorData.message || 'Failed to change password'
      }
      throw new Error(serverError.value || 'Password change failed')
    }

    state.currentPassword = ''
    state.newPassword = ''
    state.confirmPassword = ''
    serverError.value = null
  } catch {
    // Error already set in serverError.value
  } finally {
    passwordLoading.value = false
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-lock" class="text-gray-600 dark:text-gray-400" />
        <h2 class="text-lg font-semibold">
          Change Password
        </h2>
      </div>
    </template>

    <form class="space-y-5" @submit.prevent="onSubmit">
      <div class="grid gap-5">
        <UFormField
          label="Current Password"
          required
          :error="currentPasswordError || undefined"
        >
          <UInput
            v-model="state.currentPassword"
            type="password"
            placeholder="Enter your current password"
            :disabled="passwordLoading"
            size="xl"
            icon="i-lucide-key"
            :ui="{ base: 'transition-all duration-200 py-3.5' }"
          />
        </UFormField>
        <UFormField
          label="New Password"
          required
          :error="newPasswordError || undefined"
        >
          <UInput
            v-model="state.newPassword"
            type="password"
            placeholder="Enter your new password"
            :disabled="passwordLoading"
            size="xl"
            icon="i-lucide-lock"
            :ui="{ base: 'transition-all duration-200 py-3.5' }"
          />
        </UFormField>

        <UFormField
          label="Confirm New Password"
          required
          :error="confirmPasswordError || undefined"
        >
          <UInput
            v-model="state.confirmPassword"
            type="password"
            placeholder="Re-enter your new password"
            :disabled="passwordLoading"
            size="xl"
            icon="i-lucide-shield-check"
            :ui="{ base: 'transition-all duration-200 py-3.5' }"
          />
        </UFormField>
      </div>

      <UAlert
        v-if="serverError"
        color="error"
        icon="i-lucide-alert-circle"
        :title="serverError"
        :close-button="{ icon: 'i-lucide-x', color: 'error', variant: 'ghost' }"
        @close="serverError = null"
      />

      <div class="flex items-center justify-start gap-4 pt-2 border-t border-gray-200 dark:border-gray-700">
        <UButton
          type="submit"
          color="primary"
          size="lg"
          :loading="passwordLoading"
          :disabled="passwordLoading || hasErrors"
          icon="i-lucide-save"
        >
          Update Password
        </UButton>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Keep your account secure with a strong password
        </p>
      </div>
    </form>
  </UCard>
</template>
