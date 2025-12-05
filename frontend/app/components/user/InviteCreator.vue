<script setup lang="ts">
import type { CreateInviteRequest, InviteCreateResponse } from '~/api/inviteApi'
import { useAuth } from '~/composables/auth/useAuth'

const { user } = useAuth()
const loading = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)
const createdInvite = ref<InviteCreateResponse | null>(null)
const canCreate = computed(() => user.value?.role === 'ADMIN')

const createInvite = async () => {
  if (!canCreate.value) return
  loading.value = true
  error.value = null
  success.value = null
  createdInvite.value = null
  try {
    const request: CreateInviteRequest = {}
    const resp = await $fetch<InviteCreateResponse>('/api/invites', {
      method: 'POST',
      body: request
    })
    createdInvite.value = resp
    success.value = 'Invite created successfully'
  } catch (e) {
    const anyErr = e as { data?: { message?: string } }
    error.value = anyErr?.data?.message || 'Failed to create invite'
  } finally {
    loading.value = false
  }
}

const copyLink = async () => {
  if (!createdInvite.value) return
  try {
    await navigator.clipboard.writeText(createdInvite.value.invitationUrl)
    success.value = 'Copied to clipboard'
  } catch {
    error.value = 'Failed to copy'
  }
}
</script>

<template>
  <div class="space-y-4">
    <UAlert
      v-if="error"
      color="error"
      icon="i-lucide-alert-circle"
      :title="error"
      @close="error = null"
    />
    <UAlert
      v-if="success"
      color="success"
      icon="i-lucide-check-circle"
      :title="success"
      @close="success = null"
    />

    <div class="space-y-3">
      <div class="flex gap-2">
        <UButton
          color="primary"
          icon="i-lucide-link"
          :disabled="!canCreate || loading"
          :loading="loading"
          @click="createInvite"
        >
          Create Invite
        </UButton>
        <UButton
          v-if="createdInvite"
          color="neutral"
          variant="soft"
          icon="i-lucide-clipboard"
          @click="copyLink"
        >
          Copy Link
        </UButton>
      </div>
    </div>

    <div v-if="createdInvite" class="space-y-2">
      <div class="text-sm text-gray-700 dark:text-gray-300 break-all">
        <span class="font-medium">Invite URL:</span>
        <UButton
          variant="link"
          color="primary"
          :to="createdInvite.invitationUrl"
          target="_blank"
        >
          {{ createdInvite.invitationUrl }}
        </UButton>
      </div>
      <div class="text-xs text-gray-500 dark:text-gray-400">
        Expires: {{ new Date(createdInvite.expiresAt).toLocaleString() }}
      </div>
    </div>
  </div>
</template>
