<script setup lang="ts">
import { inviteApi } from '~/utils/api'
import type { RegisterWithInviteRequest } from '~/utils/api'
import { useAuth } from '~/composables/useAuth'

definePageMeta({ layout: false })

interface InviteValidation {
  valid: boolean
  reason?: string
  expiresAt?: string
}

const route = useRoute()
const token = route.params.token as string
const { login } = useAuth()

const validation = ref<InviteValidation | null>(null)
const loading = ref(true)
const submitting = ref(false)
const error = ref<string | null>(null)
const success = ref(false)

const form = reactive<RegisterWithInviteRequest>({
  username: '',
  email: '',
  password: '',
  firstName: '',
  lastName: ''
})
const showPassword = ref(false)
const passwordError = ref<string | null>(null)

const validatePassword = (password: string): string | null => {
  if (password.length < 8) {
    return 'Password must be at least 8 characters long'
  }
  if (!/\d/.test(password)) {
    return 'Password must contain at least one number'
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>?]/.test(password)) {
    return 'Password must contain at least one special character'
  }
  return null
}

const handlePasswordChange = () => {
  if (form.password) {
    passwordError.value = validatePassword(form.password)
  } else {
    passwordError.value = null
  }
}

onMounted(async () => {
  try {
    validation.value = await inviteApi.validate(token)
  } catch {
    error.value = 'Failed to validate invite'
  } finally {
    loading.value = false
  }
})

const register = async () => {
  if (!validation.value?.valid) return

  const pwdError = validatePassword(form.password)
  if (pwdError) {
    passwordError.value = pwdError
    return
  }

  submitting.value = true
  error.value = null
  try {
    const resp = await inviteApi.register(token, form)
    if (resp.token) {
      await login({ username: form.username, password: form.password })
      success.value = true
      await navigateTo('/')
    } else {
      error.value = resp.message || 'Registration failed'
    }
  } catch (e) {
    const anyErr = e as { data?: { message?: string } }
    error.value = anyErr?.data?.message || 'Registration failed'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-6">
    <UCard class="w-full max-w-md">
      <template #header>
        <h1 class="text-xl font-semibold">
          Invite Registration
        </h1>
      </template>

      <div v-if="loading" class="py-8 text-center">
        <UIcon name="i-lucide-loader-2" class="animate-spin text-2xl text-gray-400" />
      </div>

      <div v-else>
        <UAlert
          v-if="error"
          class="mb-4"
          color="error"
          icon="i-lucide-alert-circle"
          :title="error"
          @close="error = null"
        />

        <div v-if="validation && !validation.valid" class="space-y-4">
          <UAlert
            color="error"
            :icon="validation.reason?.toLowerCase().includes('expired') ? 'i-lucide-clock-x' : 'i-lucide-ban'"
            :title="validation.reason?.toLowerCase().includes('expired') ? 'Invite Expired' : 'Invite Invalid'"
          >
            <template #description>
              <div class="space-y-2">
                <p>{{ validation.reason }}</p>
                <p v-if="validation.expiresAt" class="text-sm">
                  This invite expired on {{ new Date(validation.expiresAt).toLocaleString() }}
                </p>
              </div>
            </template>
          </UAlert>
          <UButton
            color="neutral"
            variant="ghost"
            @click="navigateTo('/')"
          >
            Go Home
          </UButton>
        </div>

        <form
          v-else
          class="space-y-5"
          @submit.prevent="register"
        >
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Username <span class="text-red-500">*</span>
            </label>
            <UInput
              v-model="form.username"
              autocomplete="off"
              placeholder="Enter your username (e.g., johndoe)"
              icon="i-lucide-user"
              size="lg"
              required
            />
            <p class="text-xs text-gray-500 dark:text-gray-400">
              Choose a unique username for your account
            </p>
          </div>

          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Email Address <span class="text-red-500">*</span>
            </label>
            <UInput
              v-model="form.email"
              type="email"
              placeholder="your.email@example.com"
              icon="i-lucide-mail"
              size="lg"
              required
            />
          </div>

          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Password <span class="text-red-500">*</span>
            </label>
            <UInput
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="Enter a secure password"
              icon="i-lucide-lock"
              size="lg"
              required
              @input="handlePasswordChange"
            />
            <UCheckbox v-model="showPassword" label="Show password" class="mt-2" />
            <p v-if="passwordError" class="text-xs text-red-500 dark:text-red-400">
              {{ passwordError }}
            </p>
            <p v-else class="text-xs text-gray-500 dark:text-gray-400">
              Must be at least 8 characters with one number and one special character
            </p>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                First Name
              </label>
              <UInput
                v-model="form.firstName"
                autocomplete="off"
                placeholder="John"
                icon="i-lucide-user-circle"
                size="lg"
              />
              <p class="text-xs text-gray-500 dark:text-gray-400">
                Optional
              </p>
            </div>
            <div class="space-y-2">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Last Name
              </label>
              <UInput
                v-model="form.lastName"
                autocomplete="off"
                placeholder="Doe"
                icon="i-lucide-user-circle"
                size="lg"
              />
              <p class="text-xs text-gray-500 dark:text-gray-400">
                Optional
              </p>
            </div>
          </div>

          <UButton
            type="submit"
            :loading="submitting"
            :disabled="submitting || !validation?.valid"
            icon="i-lucide-user-plus"
            color="primary"
            block
          >
            Create Account
          </UButton>
        </form>
      </div>

      <template #footer>
        <div class="text-xs text-gray-500 dark:text-gray-400">
          Using one-time invite token: <code>{{ token }}</code>
        </div>
      </template>
    </UCard>
  </div>
</template>
