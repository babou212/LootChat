<script setup lang="ts">
import { ConnectionQuality } from 'livekit-client'
import { useLiveKitStore } from '../../stores/livekit'

defineEmits<{
  close: []
}>()

// Device lists
const audioInputDevices = ref<MediaDeviceInfo[]>([])
const audioOutputDevices = ref<MediaDeviceInfo[]>([])

// Selected devices
const selectedInputDevice = ref<string>('')
const selectedOutputDevice = ref<string>('')

// Volume
const outputVolume = ref(100)

// State
const refreshing = ref(false)
const isTesting = ref(false)
const micLevel = ref(0)
let testCleanup: (() => void) | null = null

// Get LiveKit state
const {
  room,
  isConnected,
  participants,
  currentChannelName,
  connectionQuality
} = useLiveKit()

const store = useLiveKitStore()

// Computed
const participantCount = computed(() => participants.value.length)

const connectionStatus = computed(() => {
  if (!isConnected.value) return 'Disconnected'
  return 'Connected'
})

// Get local participant's connection quality
const localQuality = computed(() => {
  if (!room.value?.localParticipant) return ConnectionQuality.Unknown
  const identity = room.value.localParticipant.identity
  return connectionQuality.value(identity) ?? ConnectionQuality.Unknown
})

const qualityText = computed(() => {
  switch (localQuality.value) {
    case ConnectionQuality.Excellent: return 'Excellent'
    case ConnectionQuality.Good: return 'Good'
    case ConnectionQuality.Poor: return 'Poor'
    case ConnectionQuality.Lost: return 'Lost'
    default: return 'Unknown'
  }
})

const qualityClass = computed(() => {
  switch (localQuality.value) {
    case ConnectionQuality.Excellent: return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    case ConnectionQuality.Good: return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
    case ConnectionQuality.Poor: return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
    case ConnectionQuality.Lost: return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
    default: return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
  }
})

// Get per-participant quality
const participantsWithQuality = computed(() => {
  return participants.value.map((p) => {
    const quality = store.connectionQualityMap[p.odod] ?? ConnectionQuality.Unknown
    let qualityLabel = 'Unknown'
    let qualityClass = 'text-gray-400'

    switch (quality) {
      case ConnectionQuality.Excellent:
        qualityLabel = '●●●●'
        qualityClass = 'text-green-500'
        break
      case ConnectionQuality.Good:
        qualityLabel = '●●●○'
        qualityClass = 'text-blue-500'
        break
      case ConnectionQuality.Poor:
        qualityLabel = '●●○○'
        qualityClass = 'text-yellow-500'
        break
      case ConnectionQuality.Lost:
        qualityLabel = '●○○○'
        qualityClass = 'text-red-500'
        break
      default:
        qualityLabel = '○○○○'
        qualityClass = 'text-gray-400'
    }

    return {
      ...p,
      qualityLabel,
      qualityClass
    }
  })
})

// Methods
const getLevelColor = (level: number): string => {
  if (level < 30) return '#10b981'
  if (level < 60) return '#f59e0b'
  return '#ef4444'
}

const loadDevices = async () => {
  try {
    await navigator.mediaDevices.getUserMedia({ audio: true })
    const devices = await navigator.mediaDevices.enumerateDevices()
    audioInputDevices.value = devices.filter(d => d.kind === 'audioinput')
    audioOutputDevices.value = devices.filter(d => d.kind === 'audiooutput')
  } catch (err) {
    console.error('Error loading audio devices:', err)
  }
}

const handleRefreshDevices = async () => {
  refreshing.value = true
  await loadDevices()
  // eslint-disable-next-line @stylistic/max-statements-per-line
  setTimeout(() => { refreshing.value = false }, 500)
}

const handleInputDeviceChange = async () => {
  if (room.value && selectedInputDevice.value) {
    try {
      await room.value.switchActiveDevice('audioinput', selectedInputDevice.value)
    } catch (err) {
      console.error('[AudioSettings] Error switching input device:', err)
    }
  }
}

const handleOutputDeviceChange = async () => {
  if (room.value && selectedOutputDevice.value) {
    try {
      await room.value.switchActiveDevice('audiooutput', selectedOutputDevice.value)
    } catch (err) {
      console.error('[AudioSettings] Error switching output device:', err)
    }
  }
}

const applyOutputVolume = () => {
  const volumeMultiplier = outputVolume.value / 100
  const audioElements = document.querySelectorAll('audio[id^="audio-"]')
  audioElements.forEach((el) => {
    (el as HTMLAudioElement).volume = volumeMultiplier
  })
}

const testMicrophone = async () => {
  // eslint-disable-next-line @stylistic/max-statements-per-line
  if (testCleanup) { testCleanup(); testCleanup = null }
  try {
    isTesting.value = true
    micLevel.value = 0
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: selectedInputDevice.value ? { deviceId: selectedInputDevice.value } : true
    })
    const audioContext = new AudioContext()
    const analyser = audioContext.createAnalyser()
    const source = audioContext.createMediaStreamSource(stream)
    source.connect(analyser)
    analyser.fftSize = 256
    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    const updateLevel = () => {
      if (!isTesting.value) return
      analyser.getByteFrequencyData(dataArray)
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
      micLevel.value = Math.round((average / 255) * 100)
      requestAnimationFrame(updateLevel)
    }
    updateLevel()
    testCleanup = () => {
      isTesting.value = false
      micLevel.value = 0
      stream.getTracks().forEach(track => track.stop())
      audioContext.close()
    }
    // eslint-disable-next-line @stylistic/max-statements-per-line
    setTimeout(() => { if (testCleanup) { testCleanup(); testCleanup = null } }, 10000)
  } catch (err) {
    console.error('[AudioSettings] Microphone test failed:', err)
    isTesting.value = false
  }
}

const stopMicTest = () => {
  // eslint-disable-next-line @stylistic/max-statements-per-line
  if (testCleanup) { testCleanup(); testCleanup = null }
}

onMounted(() => {
  loadDevices()
  navigator.mediaDevices.addEventListener('devicechange', loadDevices)
  applyOutputVolume()
})

onUnmounted(() => {
  navigator.mediaDevices.removeEventListener('devicechange', loadDevices)
  stopMicTest()
})
</script>

<template>
  <div class="space-y-4">
    <!-- Microphone Selection -->
    <div>
      <div class="flex items-center justify-between mb-2">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
          <UIcon name="i-lucide-mic" class="inline mr-1" />
          Microphone
        </label>
        <button
          class="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          :disabled="refreshing"
          @click="handleRefreshDevices"
        >
          {{ refreshing ? '⟳' : '↻' }} Refresh
        </button>
      </div>
      <select
        v-model="selectedInputDevice"
        class="w-full px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
        @change="handleInputDeviceChange"
      >
        <option value="">
          System Default
        </option>
        <option v-for="device in audioInputDevices" :key="device.deviceId" :value="device.deviceId">
          {{ device.label || 'Unnamed Device' }}
        </option>
      </select>

      <!-- Mic Test -->
      <div class="mt-2">
        <UButton
          :color="isTesting ? 'neutral' : 'primary'"
          size="sm"
          class="w-full"
          @click="isTesting ? stopMicTest() : testMicrophone()"
        >
          {{ isTesting ? '⏸️ Stop Test' : '▶️ Test Microphone' }}
        </UButton>
        <div v-if="isTesting" class="mt-2 relative h-6 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
          <div
            class="h-full rounded transition-all duration-100"
            :style="{ width: micLevel + '%', backgroundColor: getLevelColor(micLevel) }"
          />
          <span class="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-700 dark:text-gray-200">
            {{ micLevel }}%
          </span>
        </div>
      </div>
    </div>

    <!-- Speaker Selection -->
    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        <UIcon name="i-lucide-volume-2" class="inline mr-1" />
        Speakers
      </label>
      <select
        v-model="selectedOutputDevice"
        class="w-full px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
        @change="handleOutputDeviceChange"
      >
        <option value="">
          System Default
        </option>
        <option v-for="device in audioOutputDevices" :key="device.deviceId" :value="device.deviceId">
          {{ device.label || 'Unnamed Device' }}
        </option>
      </select>

      <!-- Volume Slider -->
      <div class="mt-2">
        <div class="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
          <span>Output Volume</span>
          <span class="font-semibold text-primary-600">{{ outputVolume }}%</span>
        </div>
        <input
          v-model.number="outputVolume"
          type="range"
          min="0"
          max="100"
          class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
          @input="applyOutputVolume"
        >
      </div>
    </div>

    <!-- Connection Quality -->
    <div v-if="isConnected" class="pt-2 border-t border-gray-200 dark:border-gray-700">
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        <UIcon name="i-lucide-wifi" class="inline mr-1" />
        Connection Quality
      </label>

      <div class="inline-block px-3 py-1 rounded-full text-sm font-medium mb-3" :class="qualityClass">
        {{ qualityText }}
      </div>

      <!-- Metrics Grid -->
      <div class="grid grid-cols-3 gap-2 text-center">
        <div class="p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
          <div class="text-xs text-gray-500 dark:text-gray-400 uppercase">
            Participants
          </div>
          <div class="text-sm font-semibold text-gray-900 dark:text-white">
            {{ participantCount }}
          </div>
        </div>
        <div class="p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
          <div class="text-xs text-gray-500 dark:text-gray-400 uppercase">
            Status
          </div>
          <div class="text-sm font-semibold text-gray-900 dark:text-white">
            {{ connectionStatus }}
          </div>
        </div>
        <div class="p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
          <div class="text-xs text-gray-500 dark:text-gray-400 uppercase">
            Channel
          </div>
          <div class="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {{ currentChannelName || 'N/A' }}
          </div>
        </div>
      </div>

      <!-- Participant Quality List -->
      <div v-if="participantsWithQuality.length > 0" class="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700">
        <div class="text-xs text-gray-500 dark:text-gray-400 uppercase mb-2">
          Participant Quality
        </div>
        <div
          v-for="p in participantsWithQuality"
          :key="p.odod"
          class="flex items-center justify-between py-1 text-sm"
        >
          <span class="text-gray-700 dark:text-gray-300">{{ p.username }}</span>
          <span class="font-mono tracking-wider" :class="p.qualityClass">{{ p.qualityLabel }}</span>
        </div>
      </div>
    </div>

    <!-- Not Connected -->
    <div v-else class="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-center">
      <p class="text-sm text-gray-500 dark:text-gray-400">
        Join a voice channel to see connection quality metrics.
      </p>
    </div>
  </div>
</template>
