<script setup lang="ts">
import { z } from 'zod'
import { inviteApi } from '~/api/inviteApi'
import { userApi } from '~/api/userApi'
import type { RegisterWithInviteRequest } from '~/api/inviteApi'
import { useAuth } from '~/composables/useAuth'

definePageMeta({ layout: false })

interface InviteValidation {
  valid: boolean
  reason?: string
  expiresAt?: string
}

const passwordSchema = z.string()
  .min(12, 'Password must be at least 12 characters long')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/\d/, 'Password must contain at least one number')
  .regex(/[!@#$%^&*()_+=[\]{};':"\\|,.<>?-]/, 'Password must contain at least one special character')
  .refine(
    (password) => {
      return !/(.)\1{2,}/.test(password)
    },
    'Password cannot contain more than 2 consecutive identical characters'
  )

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
const passwordErrors = ref<string[]>([])
const usernameError = ref<string | null>(null)
const emailError = ref<string | null>(null)
const checkingUsername = ref(false)
const checkingEmail = ref(false)

let usernameCheckTimeout: ReturnType<typeof setTimeout> | null = null
let emailCheckTimeout: ReturnType<typeof setTimeout> | null = null

const validatePassword = (password: string): string[] => {
  if (!password) return []

  const result = passwordSchema.safeParse(password)
  if (result.success) {
    return []
  }

  return result.error.issues.map((err: { message: string }) => err.message)
}

const handlePasswordChange = async () => {
  // Wait for v-model to update (important for paste events)
  await nextTick()
  passwordErrors.value = validatePassword(form.password)
}

const handleUsernameChange = async () => {
  await nextTick()

  usernameError.value = null

  if (!form.username || form.username.length < 3) {
    if (form.username && form.username.length < 3) {
      usernameError.value = 'Username must be at least 3 characters'
    }
    return
  }

  if (usernameCheckTimeout) {
    clearTimeout(usernameCheckTimeout)
  }

  checkingUsername.value = true
  usernameCheckTimeout = setTimeout(async () => {
    try {
      const result = await userApi.checkUsername(form.username)
      console.log('Username check result:', result)
      if (result.exists) {
        usernameError.value = 'This username is already taken'
      } else {
        usernameError.value = null
      }
    } catch (err) {
      console.error('Failed to check username:', err)
      // Don't show error to user, just allow them to continue
    } finally {
      checkingUsername.value = false
    }
  }, 500)
}

const handleEmailChange = async () => {
  await nextTick()

  emailError.value = null

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!form.email || !emailRegex.test(form.email)) {
    if (form.email && !emailRegex.test(form.email)) {
      emailError.value = 'Please enter a valid email address'
    }
    return
  }

  if (emailCheckTimeout) {
    clearTimeout(emailCheckTimeout)
  }

  checkingEmail.value = true
  emailCheckTimeout = setTimeout(async () => {
    try {
      const result = await userApi.checkEmail(form.email)
      console.log('Email check result:', result)
      if (result.exists) {
        emailError.value = 'This email is already registered'
      } else {
        emailError.value = null
      }
    } catch (err) {
      console.error('Failed to check email:', err)
      // Don't show error to user, just allow them to continue
    } finally {
      checkingEmail.value = false
    }
  }, 500)
}

const isFormValid = computed(() => {
  return validation.value?.valid
    && form.username
    && form.email
    && form.password
    && passwordErrors.value.length === 0
    && !usernameError.value
    && !emailError.value
    && !checkingUsername.value
    && !checkingEmail.value
})

onMounted(async () => {
  try {
    validation.value = await inviteApi.validate(token)
  } catch {
    error.value = 'Failed to validate invite'
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  if (usernameCheckTimeout) {
    clearTimeout(usernameCheckTimeout)
  }
  if (emailCheckTimeout) {
    clearTimeout(emailCheckTimeout)
  }
})

const register = async () => {
  if (!validation.value?.valid) return

  const errors = validatePassword(form.password)
  if (errors.length > 0) {
    passwordErrors.value = errors
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
              :loading="checkingUsername"
              @input="handleUsernameChange"
              @paste="handleUsernameChange"
            />
            <p v-if="usernameError" class="text-xs text-red-500 dark:text-red-400 flex items-start gap-1">
              <UIcon name="i-lucide-alert-circle" class="shrink-0 mt-0.5" />
              <span>{{ usernameError }}</span>
            </p>
            <p v-else-if="form.username && !checkingUsername && !usernameError && form.username.length >= 3" class="text-xs text-green-500 dark:text-green-400 flex items-start gap-1">
              <UIcon name="i-lucide-check-circle" class="shrink-0 mt-0.5" />
              <span>Username is available</span>
            </p>
            <p v-else class="text-xs text-gray-500 dark:text-gray-400">
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
              :loading="checkingEmail"
              @input="handleEmailChange"
              @paste="handleEmailChange"
            />
            <p v-if="emailError" class="text-xs text-red-500 dark:text-red-400 flex items-start gap-1">
              <UIcon name="i-lucide-alert-circle" class="shrink-0 mt-0.5" />
              <span>{{ emailError }}</span>
            </p>
            <p v-else-if="form.email && !checkingEmail && !emailError && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)" class="text-xs text-green-500 dark:text-green-400 flex items-start gap-1">
              <UIcon name="i-lucide-check-circle" class="shrink-0 mt-0.5" />
              <span>Email is available</span>
            </p>
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
              @paste="handlePasswordChange"
            />
            <UCheckbox v-model="showPassword" label="Show password" class="mt-2" />
            <div v-if="passwordErrors.length > 0" class="space-y-1 mt-2">
              <p
                v-for="(err, idx) in passwordErrors"
                :key="idx"
                class="text-xs text-red-500 dark:text-red-400 flex items-start gap-1"
              >
                <UIcon name="i-lucide-alert-circle" class="shrink-0 mt-0.5" />
                <span>{{ err }}</span>
              </p>
            </div>
            <p v-else class="text-xs text-gray-500 dark:text-gray-400">
              Must be at least 12 characters with uppercase, lowercase, number, and special character
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
            :disabled="submitting || !isFormValid"
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
