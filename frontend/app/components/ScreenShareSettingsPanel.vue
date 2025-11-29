<script setup lang="ts">
import { useWebRTCStore, SCREEN_SHARE_PROFILES, type ScreenShareQuality } from '../../stores/webrtc'

const store = useWebRTCStore()

const selectedQuality = ref<ScreenShareQuality>(store.screenShareQuality)

const qualityOptions = computed(() => {
  return Object.entries(SCREEN_SHARE_PROFILES).map(([key, value]) => ({
    value: key as ScreenShareQuality,
    label: value.label,
    description: value.description,
    resolution: value.width > 0 ? `${value.width}x${value.height}` : 'Native',
    frameRate: value.frameRate,
    bitrate: value.maxBitrate
  }))
})

const currentSettings = computed(() => store.currentScreenShareSettings)

const handleQualityChange = () => {
  store.setScreenShareQuality(selectedQuality.value)
}

const getQualityIcon = (quality: ScreenShareQuality): string => {
  const icons: Record<ScreenShareQuality, string> = {
    'source': '🖥️',
    '1080p60': '🎬',
    '1080p30': '📺',
    '720p60': '🎮',
    '720p30': '📱',
    '480p30': '📶'
  }
  return icons[quality] || '🖥️'
}

onMounted(() => {
  selectedQuality.value = store.screenShareQuality
})
</script>

<template>
  <div class="screen-share-settings-panel">
    <div class="panel-content">
      <section class="settings-section">
        <h5 class="section-title">
          Screen Share Quality
        </h5>
        <select v-model="selectedQuality" class="compact-select" @change="handleQualityChange">
          <option v-for="option in qualityOptions" :key="option.value" :value="option.value">
            {{ getQualityIcon(option.value) }} {{ option.label }}
          </option>
        </select>
        <p class="quality-description">
          {{ currentSettings.description }}
        </p>
      </section>

      <section class="settings-section">
        <h5 class="section-title">
          Current Settings
        </h5>
        <div class="settings-grid">
          <div class="setting-item">
            <span class="setting-label">Resolution</span>
            <span class="setting-value">
              {{ currentSettings.width > 0 ? `${currentSettings.width}x${currentSettings.height}` : 'Native' }}
            </span>
          </div>
          <div class="setting-item">
            <span class="setting-label">Frame Rate</span>
            <span class="setting-value">{{ currentSettings.frameRate }} fps</span>
          </div>
          <div class="setting-item">
            <span class="setting-label">Max Bitrate</span>
            <span class="setting-value">{{ currentSettings.maxBitrate }} kbps</span>
          </div>
        </div>
      </section>

      <section class="settings-section tips">
        <h5 class="section-title">
          Tips
        </h5>
        <ul class="tips-list">
          <li><strong>Gaming:</strong> Use 720p60 or 1080p60 for smooth gameplay</li>
          <li><strong>Presentations:</strong> 1080p30 provides clear text</li>
          <li><strong>Low bandwidth:</strong> Use 480p30 for stability</li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.screen-share-settings-panel {
  background: transparent;
  width: 100%;
  font-size: 0.875rem;
}

.panel-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
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

.quality-description {
  font-size: 0.75rem;
  color: #6b7280;
  margin: 0;
  font-style: italic;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.5rem;
  background: #f3f4f6;
  border-radius: 6px;
  text-align: center;
}

.setting-label {
  font-size: 0.625rem;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.setting-value {
  font-size: 0.875rem;
  font-weight: 600;
  color: #1f2937;
}

.tips {
  margin-top: 0.5rem;
  padding-top: 0.75rem;
  border-top: 1px solid #e5e7eb;
}

.tips-list {
  margin: 0;
  padding-left: 1rem;
  font-size: 0.75rem;
  color: #6b7280;
  line-height: 1.6;
}

.tips-list li {
  margin-bottom: 0.25rem;
}

.tips-list strong {
  color: #374151;
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

  .quality-description {
    color: #9ca3af;
  }

  .setting-item {
    background: #374151;
  }

  .setting-value {
    color: #f3f4f6;
  }

  .tips {
    border-top-color: #4b5563;
  }

  .tips-list {
    color: #9ca3af;
  }

  .tips-list strong {
    color: #d1d5db;
  }
}
</style>
