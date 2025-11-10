<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
const { user } = useAuth()
</script>

<template>
  <div class="p-6">
    <h1 class="text-2xl font-semibold mb-4">
      Profile
    </h1>

    <div v-if="user" class="space-y-3 max-w-md">
      <div class="flex items-center gap-3">
        <UIcon name="i-lucide-user" class="text-gray-500" />
        <div>
          <div class="text-sm text-gray-500">
            Username
          </div>
          <div class="font-medium">
            {{ user.username }}
          </div>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <UIcon name="i-lucide-mail" class="text-gray-500" />
        <div>
          <div class="text-sm text-gray-500">
            Email
          </div>
          <div class="font-medium">
            {{ user.email }}
          </div>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <UIcon name="i-lucide-badge-check" class="text-gray-500" />
        <div>
          <div class="text-sm text-gray-500">
            Role
          </div>
          <div class="font-medium uppercase">
            {{ user.role }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
