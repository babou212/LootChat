<script setup lang="ts">
import type { ChannelResponse } from '~/api/channelApi'
import type { Channel } from '../../shared/types/chat'
import ChannelCreate from '~/components/ChannelCreate.vue'
import ChannelDeleteConfirm from '~/components/ChannelDeleteConfirm.vue'

definePageMeta({ layout: false, middleware: 'auth' })

const { user } = useAuth()

const isAdmin = computed(() => user.value?.role === 'ADMIN')

const channels = ref<Channel[]>([])
const showDeleteConfirm = ref(false)
const channelToDelete = ref<Channel | null>(null)
const showCreate = ref(false)

const error = ref<string | null>(null)
const channelsLoading = ref(false)

const textChannels = computed(() =>
  channels.value.filter(channel => !channel.channelType || channel.channelType === 'TEXT')
)

const voiceChannels = computed(() =>
  channels.value.filter(channel => channel.channelType === 'VOICE')
)

const fetchChannels = async () => {
  channelsLoading.value = true
  try {
    const apiChannels = await $fetch<ChannelResponse[]>('/api/channels')
    channels.value = apiChannels.map((ch: ChannelResponse): Channel => ({
      id: ch.id,
      name: ch.name,
      description: ch.description || '',
      channelType: ch.channelType,
      createdAt: ch.createdAt,
      updatedAt: ch.updatedAt
    }))
  } catch (err) {
    console.error('Failed to fetch channels:', err)
    error.value = 'Failed to load channels'
  } finally {
    channelsLoading.value = false
  }
}

const confirmDeleteChannel = (channel: Channel) => {
  const name = channel.name.toLowerCase()
  if (name === 'general' || name === 'general-voice') {
    error.value = 'This channel is protected and cannot be deleted'
    return
  }
  channelToDelete.value = channel
  showDeleteConfirm.value = true
}

const closeDeleteConfirm = () => {
  showDeleteConfirm.value = false
  channelToDelete.value = null
}

const handleDeleted = async () => {
  await fetchChannels()
  closeDeleteConfirm()
}

onMounted(() => {
  if (isAdmin.value) {
    fetchChannels()
  }
})

watch(isAdmin, (admin) => {
  if (admin) {
    fetchChannels()
  }
})
</script>

<template>
  <div class="h-screen overflow-y-auto w-full p-6 bg-gray-50 dark:bg-gray-900">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">
        Profile
      </h1>
      <UButton
        color="neutral"
        variant="ghost"
        icon="i-lucide-arrow-left"
        @click="navigateTo('/')"
      >
        Back to chat
      </UButton>
    </div>

    <div v-if="user" class="space-y-6">
      <UCard>
        <template #header>
          <h2 class="text-lg font-semibold">
            User Information
          </h2>
        </template>

        <div class="space-y-4">
          <div class="flex items-center gap-3">
            <UIcon name="i-lucide-user" class="text-gray-600 dark:text-gray-400" />
            <div>
              <div class="text-sm text-gray-600 dark:text-gray-400">
                Username
              </div>
              <div class="font-medium">
                {{ user.username }}
              </div>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <UIcon name="i-lucide-mail" class="text-gray-600 dark:text-gray-400" />
            <div>
              <div class="text-sm text-gray-600 dark:text-gray-400">
                Email
              </div>
              <div class="font-medium">
                {{ user.email }}
              </div>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <UIcon name="i-lucide-badge-check" class="text-gray-600 dark:text-gray-400" />
            <div>
              <div class="text-sm text-gray-600 dark:text-gray-400">
                Role
              </div>
              <div class="font-medium uppercase">
                {{ user.role }}
              </div>
            </div>
          </div>
        </div>
      </UCard>

      <UCard v-if="isAdmin">
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold">
              Channel Management
            </h2>
            <ChannelCreate
              v-model:open="showCreate"
              @created="fetchChannels()"
              @error="error = $event"
            />
          </div>
        </template>

        <div v-if="channelsLoading" class="text-center py-8">
          <UIcon name="i-lucide-loader-2" class="animate-spin text-2xl text-gray-400 dark:text-gray-500" />
        </div>

        <div v-else class="space-y-6">
          <UAlert
            v-if="error"
            color="error"
            icon="i-lucide-alert-circle"
            :title="error"
            @close="error = null"
          />

          <div>
            <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase mb-3">
              Text Channels ({{ textChannels.length }})
            </h3>
            <div class="space-y-2">
              <div
                v-for="channel in textChannels"
                :key="channel.id"
                class="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div class="flex items-center gap-3">
                  <UIcon name="i-lucide-hash" class="text-lg text-gray-600 dark:text-gray-400" />
                  <div>
                    <div class="font-medium">
                      {{ channel.name }}
                    </div>
                    <div v-if="channel.description" class="text-sm text-gray-600 dark:text-gray-400">
                      {{ channel.description }}
                    </div>
                  </div>
                </div>
                <UButton
                  v-if="channel.name.toLowerCase() !== 'general'"
                  icon="i-lucide-trash-2"
                  size="sm"
                  variant="ghost"
                  color="error"
                  title="Delete channel"
                  @click="confirmDeleteChannel(channel)"
                />
                <UBadge v-else color="primary" variant="subtle">
                  Protected
                </UBadge>
              </div>
              <div v-if="textChannels.length === 0" class="text-center py-4 text-gray-600 dark:text-gray-400">
                No text channels
              </div>
            </div>
          </div>

          <div>
            <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase mb-3">
              Voice Channels ({{ voiceChannels.length }})
            </h3>
            <div class="space-y-2">
              <div
                v-for="channel in voiceChannels"
                :key="channel.id"
                class="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div class="flex items-center gap-3">
                  <UIcon name="i-lucide-mic" class="text-lg text-gray-600 dark:text-gray-400" />
                  <div>
                    <div class="font-medium">
                      {{ channel.name }}
                    </div>
                    <div v-if="channel.description" class="text-sm text-gray-600 dark:text-gray-400">
                      {{ channel.description }}
                    </div>
                  </div>
                </div>
                <template v-if="channel.name.toLowerCase() !== 'general-voice'">
                  <UButton
                    icon="i-lucide-trash-2"
                    size="sm"
                    variant="ghost"
                    color="error"
                    title="Delete channel"
                    @click="confirmDeleteChannel(channel)"
                  />
                </template>
                <UBadge v-else color="primary" variant="subtle">
                  Protected
                </UBadge>
              </div>
              <div v-if="voiceChannels.length === 0" class="text-center py-4 text-gray-600 dark:text-gray-400">
                No voice channels
              </div>
            </div>
          </div>
        </div>
      </UCard>

      <UCard v-if="isAdmin">
        <template #header>
          <h2 class="text-lg font-semibold">
            Invitations
          </h2>
        </template>

        <InviteCreator />
      </UCard>
    </div>
    <ChannelDeleteConfirm
      v-model:open="showDeleteConfirm"
      :channel="channelToDelete"
      @deleted="handleDeleted"
      @error="error = $event"
    />
  </div>
</template>
