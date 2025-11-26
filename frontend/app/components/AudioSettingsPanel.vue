<template>
  <div class="audio-settings-panel">
    <div class="panel-header">
      <h3>🎙️ Audio Settings</h3>
      <button class="close-btn" @click="$emit('close')">×</button>
    </div>

    <div class="panel-content">
      <!-- Audio Profile Selection -->
      <section class="settings-section">
        <h4>Audio Profile</h4>
        <div class="profile-selector">
          <div
            v-for="profile in availableProfiles"
            :key="profile"
            class="profile-option"
            :class="{ active: currentProfile === profile }"
            @click="selectProfile(profile)"
          >
            <div class="profile-icon">{{ getProfileIcon(profile) }}</div>
            <div class="profile-info">
              <strong>{{ formatProfileName(profile) }}</strong>
              <p class="profile-desc">{{ getProfileDescription(profile) }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Microphone Selection -->
      <section class="settings-section">
        <div class="section-header">
          <h4>Microphone</h4>
          <button class="refresh-btn" @click="handleRefreshDevices" :disabled="refreshing">
            {{ refreshing ? '⟳' : '↻' }} Refresh
          </button>
        </div>
        
        <select 
          v-model="selectedDeviceId" 
          class="device-select"
          @change="handleDeviceChange"
        >
          <option :value="null">System Default</option>
          <option 
            v-for="device in audioDevices" 
            :key="device.deviceId"
            :value="device.deviceId"
          >
            {{ device.label || 'Unnamed Device' }}
          </option>
        </select>

        <!-- Microphone Test -->
        <div class="mic-test">
          <button 
            class="test-btn"
            @click="handleMicTest" 
            :disabled="testing"
          >
            {{ testing ? '⏸️ Testing...' : '▶️ Test Microphone' }}
          </button>
          
          <div v-if="showLevel" class="level-meter">
            <div 
              class="level-bar" 
              :style="{ 
                width: levelPercentage + '%',
                backgroundColor: getLevelColor(levelPercentage)
              }"
            />
            <span class="level-text">{{ currentLevel.toFixed(0) }} dB</span>
          </div>
        </div>
      </section>

      <!-- Audio Processing (Optional) -->
      <section class="settings-section">
        <div class="section-header">
          <h4>Advanced Processing</h4>
          <label class="toggle">
            <input 
              type="checkbox" 
              v-model="enableProcessing"
              @change="handleProcessingToggle"
            />
            <span class="toggle-slider" />
          </label>
        </div>
        
        <div v-if="enableProcessing" class="processing-presets">
          <p class="info-text">
            Apply additional noise reduction and audio enhancement
          </p>
          <select v-model="processingPreset" class="preset-select">
            <option value="clean">Clean (Minimal)</option>
            <option value="office">Office (Moderate)</option>
            <option value="noisy">Noisy (Aggressive)</option>
            <option value="podcast">Podcast (Professional)</option>
          </select>
        </div>
      </section>

      <!-- Connection Quality (when in voice channel) -->
      <section v-if="isInVoiceChannel" class="settings-section">
        <h4>Connection Quality</h4>
        <div class="quality-display">
          <div class="quality-badge" :class="qualityClass">
            {{ qualityText }}
          </div>
          
          <div class="quality-metrics">
            <div class="metric">
              <span class="metric-label">Latency</span>
              <span class="metric-value">{{ rttMs }}ms</span>
            </div>
            <div class="metric">
              <span class="metric-label">Packet Loss</span>
              <span class="metric-value">{{ packetLoss }}</span>
            </div>
            <div class="metric">
              <span class="metric-label">Bitrate</span>
              <span class="metric-value">{{ bitrateKbps }} Kbps</span>
            </div>
          </div>

          <button 
            v-if="showAutoAdjust"
            class="auto-adjust-btn"
            @click="handleAutoAdjust"
          >
            ⚡ Auto-Adjust Quality
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAudioSettings } from '~/composables/useAudioSettings'
import { useWebRTCStore } from '~/stores/webrtc'
import type { AudioProfile } from '~/stores/webrtc'

const emit = defineEmits<{
  close: []
}>()

const audioSettings = useAudioSettings()
const store = useWebRTCStore()

// State
const selectedDeviceId = ref<string | null>(null)
const refreshing = ref(false)
const testing = ref(false)
const showLevel = ref(false)
const currentLevel = ref(-100)
const enableProcessing = ref(false)
const processingPreset = ref<'clean' | 'office' | 'noisy' | 'podcast'>('office')

// Computed
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
const bitrateKbps = computed(() => (qualityMetrics.value.avgBitrate / 1000).toFixed(0))

const levelPercentage = computed(() => {
  // Convert dB (-100 to 0) to percentage (0 to 100)
  return Math.max(0, Math.min(100, ((currentLevel.value + 100) / 100) * 100))
})

const showAutoAdjust = computed(() => {
  const recommended = audioSettings.getRecommendedProfile()
  return recommended !== currentProfile.value
})

// Methods
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

const getProfileDescription = (profile: AudioProfile): string => {
  return audioSettings.getProfileDescription(profile)
}

const selectProfile = async (profile: AudioProfile) => {
  await audioSettings.setProfile(profile)
}

const handleRefreshDevices = async () => {
  refreshing.value = true
  try {
    await audioSettings.refreshDevices()
  } finally {
    refreshing.value = false
  }
}

const handleDeviceChange = async () => {
  await audioSettings.selectDevice(selectedDeviceId.value)
}

const handleMicTest = async () => {
  testing.value = true
  showLevel.value = true
  
  try {
    const levels = await audioSettings.testAudioLevel(3000)
    
    // Animate through the levels
    let index = 0
    const interval = setInterval(() => {
      if (index < levels.length) {
        currentLevel.value = levels[index]
        index++
      } else {
        clearInterval(interval)
        testing.value = false
        setTimeout(() => {
          showLevel.value = false
        }, 2000)
      }
    }, 100)
  } catch (error) {
    console.error('Mic test failed:', error)
    testing.value = false
    showLevel.value = false
  }
}

const getLevelColor = (percentage: number): string => {
  if (percentage < 30) return '#10b981' // green
  if (percentage < 70) return '#fbbf24' // yellow
  return '#ef4444' // red
}

const handleProcessingToggle = () => {
  // TODO: Integrate with AudioProcessor
  console.log('Processing toggle:', enableProcessing.value)
}

const handleAutoAdjust = async () => {
  const adjusted = await audioSettings.autoAdjustProfile()
  if (adjusted) {
    console.log(`Auto-adjusted to ${adjusted}`)
  }
}

// Initialize
onMounted(async () => {
  // Request permissions and enumerate devices
  const hasPermission = await audioSettings.requestPermissions()
  if (hasPermission) {
    await handleRefreshDevices()
  }
  
  // Set selected device from store
  selectedDeviceId.value = store.selectedAudioDevice
})
</script>

<style scoped>
.audio-settings-panel {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  max-width: 500px;
  width: 100%;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.panel-header h3 {
  margin: 0;
  font-size: 1.25rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6b7280;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background 0.2s;
}

.close-btn:hover {
  background: #f3f4f6;
}

.panel-content {
  padding: 1.5rem;
  max-height: 600px;
  overflow-y: auto;
}

.settings-section {
  margin-bottom: 2rem;
}

.settings-section:last-child {
  margin-bottom: 0;
}

.settings-section h4 {
  margin: 0 0 1rem 0;
  font-size: 1rem;
  color: #1f2937;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

/* Profile Selector */
.profile-selector {
  display: grid;
  gap: 0.75rem;
}

.profile-option {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.profile-option:hover {
  border-color: #3b82f6;
  background: #eff6ff;
}

.profile-option.active {
  border-color: #3b82f6;
  background: #dbeafe;
}

.profile-icon {
  font-size: 2rem;
}

.profile-info {
  flex: 1;
}

.profile-info strong {
  display: block;
  margin-bottom: 0.25rem;
  color: #1f2937;
}

.profile-desc {
  margin: 0;
  font-size: 0.875rem;
  color: #6b7280;
  line-height: 1.4;
}

/* Device Selection */
.refresh-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.refresh-btn:hover:not(:disabled) {
  background: #f3f4f6;
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.device-select,
.preset-select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  background: white;
  cursor: pointer;
  transition: border-color 0.2s;
}

.device-select:focus,
.preset-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* Mic Test */
.mic-test {
  margin-top: 1rem;
}

.test-btn {
  width: 100%;
  padding: 0.75rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.test-btn:hover:not(:disabled) {
  background: #2563eb;
}

.test-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.level-meter {
  margin-top: 0.75rem;
  position: relative;
  height: 32px;
  background: #f3f4f6;
  border-radius: 6px;
  overflow: hidden;
}

.level-bar {
  height: 100%;
  transition: width 0.1s ease, background-color 0.2s;
}

.level-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 0.875rem;
  font-weight: 600;
  color: #1f2937;
  text-shadow: 0 0 2px white;
}

/* Processing */
.toggle {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 24px;
}

.toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #d1d5db;
  transition: 0.3s;
  border-radius: 24px;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
}

.toggle input:checked + .toggle-slider {
  background-color: #3b82f6;
}

.toggle input:checked + .toggle-slider:before {
  transform: translateX(24px);
}

.processing-presets {
  margin-top: 1rem;
}

.info-text {
  margin: 0 0 0.75rem 0;
  font-size: 0.875rem;
  color: #6b7280;
}

/* Quality Display */
.quality-display {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.quality-badge {
  display: inline-block;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-weight: 600;
  font-size: 0.875rem;
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

.quality-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.metric {
  text-align: center;
}

.metric-label {
  display: block;
  font-size: 0.75rem;
  color: #6b7280;
  margin-bottom: 0.25rem;
}

.metric-value {
  display: block;
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
}

.auto-adjust-btn {
  padding: 0.75rem;
  background: #f59e0b;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.auto-adjust-btn:hover {
  background: #d97706;
}
</style>
