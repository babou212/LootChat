<script setup lang="ts">
import type { ChangePasswordRequest } from '~/api/userApi'

const toast = useToast()

const passwordForm = ref<ChangePasswordRequest>({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})
const passwordLoading = ref(false)
const passwordErrors = ref<Record<string, string>>({})

const validatePasswordForm = () => {
  passwordErrors.value = {}

  if (!passwordForm.value.currentPassword) {
    passwordErrors.value.currentPassword = 'Current password is required'
  }

  if (!passwordForm.value.newPassword) {
    passwordErrors.value.newPassword = 'New password is required'
  } else if (passwordForm.value.newPassword.length < 8) {
    passwordErrors.value.newPassword = 'Password must be at least 8 characters'
  }

  if (!passwordForm.value.confirmPassword) {
    passwordErrors.value.confirmPassword = 'Please confirm your password'
  } else if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    passwordErrors.value.confirmPassword = 'Passwords do not match'
  }

  return Object.keys(passwordErrors.value).length === 0
}

const handlePasswordChange = async () => {
  if (!validatePasswordForm()) {
    return
  }

  passwordLoading.value = true
  try {
    const response = await fetch('/api/users/password', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(passwordForm.value)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Failed to change password')
    }

    toast.add({
      title: 'Success',
      description: 'Password changed successfully',
      color: 'success'
    })

    passwordForm.value = {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    }
    passwordErrors.value = {}
  } catch (err) {
    const error = err as Error
    toast.add({
      title: 'Error',
      description: error.message || 'Failed to change password',
      color: 'error'
    })
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

    <form class="space-y-6" @submit.prevent="handlePasswordChange">
      <UFormGroup
        label="Current Password"
        :error="passwordErrors.currentPassword"
        required
      >
        <UInput
          v-model="passwordForm.currentPassword"
          type="password"
          placeholder="Enter current password"
          :disabled="passwordLoading"
          size="lg"
          icon="i-lucide-key"
        />
      </UFormGroup>

      <UFormGroup
        label="New Password"
        :error="passwordErrors.newPassword"
        hint="Must be at least 8 characters"
        required
      >
        <UInput
          v-model="passwordForm.newPassword"
          type="password"
          placeholder="Enter new password"
          :disabled="passwordLoading"
          size="lg"
          icon="i-lucide-lock"
          class="pl-2"
        />
      </UFormGroup>

      <UFormGroup
        label="Confirm New Password"
        :error="passwordErrors.confirmPassword"
        required
      >
        <UInput
          v-model="passwordForm.confirmPassword"
          type="password"
          placeholder="Confirm new password"
          :disabled="passwordLoading"
          size="lg"
          icon="i-lucide-shield-check"
          class="pl-2"
        />
      </UFormGroup>

      <div class="pt-2">
        <UButton
          type="submit"
          color="primary"
          size="lg"
          :loading="passwordLoading"
          :disabled="passwordLoading"
          icon="i-lucide-save"
          block
        >
          Update Password
        </UButton>
      </div>
    </form>
  </UCard>
</template>
