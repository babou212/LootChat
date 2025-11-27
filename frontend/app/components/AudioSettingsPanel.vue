<script setup lang="ts">
import { useAudioSettings } from '../composables/useAudioSettings'
import { useWebRTCStore } from '../../stores/webrtc'
import type { AudioProfile } from '../../stores/webrtc'

const _emit = defineEmits<{
  close: []
}>()

const audioSettings = useAudioSettings()
const store = useWebRTCStore()

const selectedDeviceId = ref<string | null>(null)
const selectedProfile = ref<AudioProfile>('balanced')

const currentProfile = computed(() => audioSettings.currentProfile.value)
const availableProfiles = computed(() => audioSettings.availableProfiles.value)
const audioDevices = computed(() => audioSettings.audioDevices.value)
const isInVoiceChannel = computed(() => store.isInVoiceChannel)

const qualityMetrics = computed(() => store.audioQualitySummary)
const qualityText = computed(() => {
  const q = qualityMetrics.value.quality
  return q.charAt(0).toUpperCase() + q.slice(1)
})
const qualityClass = computed(() => `quality-${qualityMetrics.value.quality}`)
const rttMs = computed(() => (qualityMetrics.value.avgRtt * 1000).toFixed(0))
const packetLoss = computed(() => Math.round(qualityMetrics.value.avgPacketLoss))

const getProfileIcon = (profile: AudioProfile): string => {
  const icons = {
    'balanced': '⚖️',
    'high-quality': '🎵',
    'bandwidth-saving': '📶',
    'noise-canceling': '🔇'
  }
  return icons[profile] || '🎙️'
}

const formatProfileName = (profile: AudioProfile): string => {
  return profile.split('-').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ')
}

const handleProfileChange = async () => {
  await audioSettings.setProfile(selectedProfile.value)
}

const handleDeviceChange = async () => {
  await audioSettings.selectDevice(selectedDeviceId.value)
}

onMounted(async () => {
  const hasPermission = await audioSettings.requestPermissions()
  if (hasPermission) {
    await audioSettings.refreshDevices()
  }

  selectedDeviceId.value = store.selectedAudioDevice
  selectedProfile.value = currentProfile.value
})
</script>

<template>
  <div class="audio-settings-panel">
    <div class="panel-content">
      <section class="settings-section">
        <h5 class="section-title">
          Audio Profile
        </h5>
        <select v-model="selectedProfile" class="compact-select" @change="handleProfileChange">
          <option v-for="profile in availableProfiles" :key="profile" :value="profile">
            {{ getProfileIcon(profile) }} {{ formatProfileName(profile) }}
          </option>
        </select>
      </section>
      <section class="settings-section">
        <h5 class="section-title">
          Microphone
        </h5>
        <select
          v-model="selectedDeviceId"
          class="compact-select"
          @change="handleDeviceChange"
        >
          <option :value="null">
            System Default
          </option>
          <option
            v-for="device in audioDevices"
            :key="device.deviceId"
            :value="device.deviceId"
          >
            {{ device.label || 'Unnamed Device' }}
          </option>
        </select>
      </section>

      <!-- Connection Quality (when in voice channel) -->
      <section v-if="isInVoiceChannel" class="settings-section">
        <h5 class="section-title">
          Connection Quality
        </h5>
        <div class="quality-compact">
          <div class="quality-badge-compact" :class="qualityClass">
            {{ qualityText }}
          </div>
          <div class="metrics-compact">
            <span class="metric-compact">{{ rttMs }}ms</span>
            <span class="metric-compact">{{ packetLoss }} loss</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.audio-settings-panel {
  background: transparent;
  width: 100%;
  font-size: 0.875rem;
}

.panel-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.section-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0;
}

.compact-select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.8125rem;
  background: white;
  cursor: pointer;
  transition: border-color 0.2s;
}

.compact-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.quality-compact {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.quality-badge-compact {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.375rem 0.75rem;
  border-radius: 12px;
  font-weight: 600;
  font-size: 0.75rem;
  text-align: center;
}

.quality-excellent {
  background: #d1fae5;
  color: #065f46;
}

.quality-good {
  background: #dbeafe;
  color: #1e40af;
}

.quality-poor {
  background: #fee2e2;
  color: #991b1b;
}

.quality-disconnected {
  background: #f3f4f6;
  color: #6b7280;
}

.metrics-compact {
  display: flex;
  gap: 0.5rem;
  font-size: 0.75rem;
}

.metric-compact {
  flex: 1;
  text-align: center;
  padding: 0.25rem;
  background: #f3f4f6;
  border-radius: 4px;
  color: #4b5563;
  font-weight: 500;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .compact-select {
    background: #374151;
    border-color: #4b5563;
    color: #f3f4f6;
  }

  .section-title {
    color: #9ca3af;
  }

  .quality-excellent {
    background: rgba(16, 185, 129, 0.2);
    color: #6ee7b7;
  }

  .quality-good {
    background: rgba(59, 130, 246, 0.2);
    color: #93c5fd;
  }

  .quality-poor {
    background: rgba(245, 158, 11, 0.2);
    color: #fcd34d;
  }

  .quality-disconnected {
    background: rgba(75, 85, 99, 0.3);
  }
}
</style>
