<script setup lang="ts">
import type { FormSubmitEvent } from '#ui/types'
import { z } from 'zod'

definePageMeta({
  layout: false,
  middleware: 'auth'
})

const { login, loading, error } = useAuth()

const schema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be less than 50 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores and hyphens'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(255, 'Password is too long')
})

type Schema = z.output<typeof schema>

const state = reactive<Schema>({
  username: '',
  password: ''
})

const onSubmit = async (event: FormSubmitEvent<Schema>) => {
  const result = await login(event.data)

  if (result.success) {
    await navigateTo('/')
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
              Welcome Back
            </h1>
            <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Sign in to your LootChat account
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
          label="Username"
          name="username"
          required
          :ui="{ label: { base: 'font-semibold text-gray-700 dark:text-gray-200' } }"
        >
          <UInput
            v-model="state.username"
            placeholder="Enter your username"
            icon="i-lucide-user"
            size="xl"
            :disabled="loading"
            class="focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 transition-all duration-200 w-full"
          />
        </UFormGroup>

        <UFormGroup
          label="Password"
          name="password"
          required
          :ui="{ label: { base: 'font-semibold text-gray-700 dark:text-gray-200' } }"
        >
          <UInput
            v-model="state.password"
            type="password"
            placeholder="Enter your password"
            icon="i-lucide-lock"
            size="xl"
            :disabled="loading"
            class="focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 transition-all duration-200 w-full pt-3 pb-3"
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
          :disabled="!state.username || !state.password"
          class="font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02]"
        >
          Sign In
        </UButton>
      </UForm>
    </UCard>
  </div>
</template>
