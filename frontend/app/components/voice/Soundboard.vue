<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useSoundboardStore } from '../../../stores/soundboard'
import { useAuthStore } from '../../../stores/auth'
import type { SoundboardSound } from '../../../shared/types/soundboard'
import type { Client } from '@stomp/stompjs'
import { Mp3Encoder } from '@breezystack/lamejs'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js'

interface Props {
  stompClient: Client | null
  compact?: boolean
  channelId: number
}

interface Emits {
  (e: 'close'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const soundboardStore = useSoundboardStore()
const authStore = useAuthStore()
const toast = useToast()

const showUploadModal = ref(false)
const uploadName = ref('')
const uploadFile = ref<File | null>(null)
const uploadDuration = ref(0)
const uploading = ref(false)
const audioContext = ref<AudioContext | null>(null)
const audioUrl = ref<string | null>(null)
const audioElement = ref<HTMLAudioElement | null>(null)
const trimStart = ref(0)
const trimEnd = ref(0)
const isPlaying = ref(false)
const waveformContainer = ref<HTMLDivElement | null>(null)
const wavesurfer = ref<WaveSurfer | null>(null)
const wsRegion = ref<any>(null)
const searchQuery = ref('')

const sounds = computed(() => soundboardStore.allSounds)
const loading = computed(() => soundboardStore.isLoading)

const filteredSounds = computed(() => {
  if (!searchQuery.value.trim()) return sounds.value
  const query = searchQuery.value.toLowerCase()
  return sounds.value.filter(s =>
    s.name.toLowerCase().includes(query)
    || s.username.toLowerCase().includes(query)
  )
})

onMounted(async () => {
  await soundboardStore.fetchSounds()
})

onBeforeUnmount(() => {
  if (audioContext.value) {
    audioContext.value.close()
  }
})

async function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) return

  const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/aac']
  if (!validTypes.includes(file.type)) {
    toast.add({
      title: 'Invalid file type',
      description: 'Please select an audio file (MP3, WAV, OGG, M4A, AAC)',
      color: 'error'
    })
    return
  }

  if (file.size > 10 * 1024 * 1024) {
    toast.add({
      title: 'File too large',
      description: 'Maximum file size is 10MB',
      color: 'error'
    })
    return
  }

  uploadFile.value = file

  try {
    const duration = await getAudioDuration(file)
    uploadDuration.value = Math.floor(duration * 1000)

    if (audioUrl.value) {
      URL.revokeObjectURL(audioUrl.value)
    }
    audioUrl.value = URL.createObjectURL(file)

    trimStart.value = 0
    trimEnd.value = Math.min(duration, 30)

    await initWaveSurfer(file)
  } catch (error) {
    console.error('Failed to get audio duration:', error)
    toast.add({
      title: 'Invalid audio file',
      description: 'Could not read audio file',
      color: 'error'
    })
    uploadFile.value = null
  }
}

async function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio()
    audio.preload = 'metadata'

    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(audio.src)
      resolve(audio.duration)
    }

    audio.onerror = () => {
      URL.revokeObjectURL(audio.src)
      reject(new Error('Failed to load audio'))
    }

    audio.src = URL.createObjectURL(file)
  })
}

async function uploadSound() {
  if (!uploadName.value.trim() || !uploadFile.value) return

  uploading.value = true
  try {
    let fileToUpload = uploadFile.value
    let durationToUpload = uploadDuration.value

    if (trimStart.value > 0 || trimEnd.value < uploadDuration.value / 1000) {
      const trimmedFile = await trimAudioFile(uploadFile.value, trimStart.value, trimEnd.value)
      fileToUpload = trimmedFile
      durationToUpload = Math.floor(trimmedDuration.value * 1000)
    }

    await soundboardStore.uploadSound(
      uploadName.value.trim(),
      durationToUpload,
      fileToUpload
    )

    toast.add({
      title: 'Sound uploaded',
      description: `"${uploadName.value}" has been added to the soundboard`,
      color: 'success'
    })

    closeUploadModal()
  } catch (error: unknown) {
    const err = error as { data?: { message?: string }, message?: string, statusCode?: number }
    toast.add({
      title: 'Upload failed',
      description: err.data?.message || err.message || 'Failed to upload sound',
      color: 'error'
    })
  } finally {
    uploading.value = false
  }
}

async function trimAudioFile(file: File, startTime: number, endTime: number): Promise<File> {
  const audioContext = new AudioContext()
  const arrayBuffer = await file.arrayBuffer()
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

  const sampleRate = audioBuffer.sampleRate
  const startSample = Math.floor(startTime * sampleRate)
  const endSample = Math.floor(endTime * sampleRate)
  const trimmedLength = endSample - startSample

  const trimmedBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    trimmedLength,
    sampleRate
  )

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel)
    const trimmedData = trimmedBuffer.getChannelData(channel)
    for (let i = 0; i < trimmedLength; i++) {
      trimmedData[i] = channelData[startSample + i] || 0
    }
  }

  const mp3Blob = await audioBufferToMp3(trimmedBuffer)
  return new File([mp3Blob], file.name.replace(/\.[^/.]+$/, '.mp3'), { type: 'audio/mpeg' })
}

async function audioBufferToMp3(buffer: AudioBuffer): Promise<Blob> {
  const sampleRate = buffer.sampleRate
  const numberOfChannels = buffer.numberOfChannels
  const kbps = 128
  const mp3encoder = new Mp3Encoder(numberOfChannels, sampleRate, kbps)

  const mp3Data: Uint8Array[] = []
  const sampleBlockSize = 1152

  const left = new Int16Array(buffer.length)
  const right = numberOfChannels > 1 ? new Int16Array(buffer.length) : null

  const leftData = buffer.getChannelData(0)
  for (let i = 0; i < buffer.length; i++) {
    left[i] = Math.max(-1, Math.min(1, leftData[i] || 0)) * 0x7FFF
  }

  if (right) {
    const rightData = buffer.getChannelData(1)
    for (let i = 0; i < buffer.length; i++) {
      right[i] = Math.max(-1, Math.min(1, rightData[i] || 0)) * 0x7FFF
    }
  }

  for (let i = 0; i < buffer.length; i += sampleBlockSize) {
    const leftChunk = left.subarray(i, i + sampleBlockSize)
    const rightChunk = right ? right.subarray(i, i + sampleBlockSize) : leftChunk
    const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk)
    if (mp3buf.length > 0) {
      mp3Data.push(mp3buf)
    }
  }

  const mp3buf = mp3encoder.flush()
  if (mp3buf.length > 0) {
    mp3Data.push(mp3buf)
  }

  return new Blob(mp3Data as BlobPart[], { type: 'audio/mpeg' })
}

function closeUploadModal() {
  showUploadModal.value = false
  uploadName.value = ''
  uploadFile.value = null
  uploadDuration.value = 0
  trimStart.value = 0
  trimEnd.value = 0
  isPlaying.value = false

  if (wavesurfer.value) {
    wavesurfer.value.destroy()
    wavesurfer.value = null
  }

  if (audioUrl.value) {
    URL.revokeObjectURL(audioUrl.value)
    audioUrl.value = null
  }

  if (audioElement.value) {
    audioElement.value.pause()
    audioElement.value = null
  }
}

async function triggerSound(soundId: number) {
  try {
    await soundboardStore.playSound(props.channelId, soundId)
  } catch {
    toast.add({
      title: 'Failed to play sound',
      description: 'Could not broadcast sound to channel',
      color: 'error'
    })
  }
}

async function deleteSound(soundId: number) {
  const sound = sounds.value.find(s => s.id === soundId)
  if (!sound) return

  try {
    await soundboardStore.deleteSound(soundId)
    toast.add({
      title: 'Sound deleted',
      description: `"${sound.name}" has been removed`,
      color: 'success'
    })
  } catch {
    toast.add({
      title: 'Failed to delete sound',
      description: 'Could not delete sound',
      color: 'error'
    })
  }
}

function canDeleteSound(sound: SoundboardSound): boolean {
  return sound.userId === authStore.user?.userId || authStore.user?.role === 'ADMIN'
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

async function playPreview() {
  if (!audioUrl.value) return

  if (isPlaying.value && audioElement.value) {
    audioElement.value.pause()
    audioElement.value.currentTime = trimStart.value
    isPlaying.value = false
    return
  }

  if (audioElement.value) {
    audioElement.value.pause()
    audioElement.value.remove()
  }

  audioElement.value = new Audio(audioUrl.value)
  audioElement.value.currentTime = trimStart.value
  isPlaying.value = true

  const playUntil = trimEnd.value
  const startFrom = trimStart.value

  const checkTime = () => {
    if (audioElement.value) {
      if (audioElement.value.currentTime >= playUntil) {
        audioElement.value.pause()
        audioElement.value.currentTime = startFrom
        isPlaying.value = false
        audioElement.value.removeEventListener('timeupdate', checkTime)
        audioElement.value.removeEventListener('ended', onEnded)
      }
    }
  }

  const onEnded = () => {
    isPlaying.value = false
    if (audioElement.value) {
      audioElement.value.removeEventListener('timeupdate', checkTime)
      audioElement.value.removeEventListener('ended', onEnded)
    }
  }

  audioElement.value.addEventListener('timeupdate', checkTime)
  audioElement.value.addEventListener('ended', onEnded)

  try {
    await audioElement.value.play()
  } catch (err) {
    console.error('Failed to play preview:', err)
    isPlaying.value = false
  }
}

const trimmedDuration = computed(() => trimEnd.value - trimStart.value)

async function initWaveSurfer(file: File) {
  // Wait for DOM to be ready
  await nextTick()

  // Destroy previous instance
  if (wavesurfer.value) {
    wavesurfer.value.destroy()
    wavesurfer.value = null
  }

  if (!waveformContainer.value) {
    console.error('Waveform container not found')
    return
  }

  try {
    // Create WaveSurfer instance
    wavesurfer.value = WaveSurfer.create({
      container: waveformContainer.value,
      waveColor: '#6b7280',
      progressColor: '#6b7280',
      height: 128,
      barWidth: 3,
      barGap: 1,
      barRadius: 2,
      normalize: true,
      backend: 'MediaElement', // Faster than WebAudio
      sampleRate: 8000, // Minimum valid sample rate for faster loading
      dragToSeek: false,
      interact: false
    })

    // Add regions plugin first
    const wsRegions = wavesurfer.value.registerPlugin(RegionsPlugin.create())

    // Set up ready event before loading
    wavesurfer.value.once('ready', () => {
      const duration = wavesurfer.value!.getDuration()
      const endTime = Math.min(duration, 30)

      // Create initial region with better styling
      wsRegion.value = wsRegions.addRegion({
        start: 0,
        end: endTime,
        color: 'rgba(59, 130, 246, 0.3)', // Blue with transparency
        drag: true,
        resize: true
      })

      // Update trim values when region changes
      wsRegion.value.on('update', () => {
        let start = wsRegion.value.start
        let end = wsRegion.value.end

        // Enforce 30 second max
        if (end - start > 30) {
          end = start + 30
          wsRegion.value.setOptions({ end })
        }

        trimStart.value = start
        trimEnd.value = end
      })
    })

    // Load the audio file
    await wavesurfer.value.loadBlob(file)
  } catch (error) {
    console.error('Failed to initialize WaveSurfer:', error)
  }
}
</script>

<template>
  <div :class="['flex flex-col h-full', compact ? 'bg-gray-50 dark:bg-gray-900' : 'bg-white dark:bg-gray-800']">
    <!-- Header with Close Button -->
    <div class="flex items-center justify-between p-3 border-b border-gray-700 bg-gray-900">
      <h3 class="text-sm font-semibold text-white">
        Soundboard
      </h3>
      <button
        type="button"
        class="text-gray-400 hover:text-gray-200 transition-colors"
        @click="emit('close')"
      >
        <UIcon name="i-lucide-x" class="w-5 h-5" />
      </button>
    </div>

    <!-- Search Bar -->
    <div class="p-3 border-b border-gray-200 dark:border-gray-700">
      <div class="relative">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Find the perfect sound"
          class="w-full px-3 py-2 pl-10 pr-10 bg-gray-900 dark:bg-black text-white text-sm rounded-lg border border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder-gray-400"
        >
        <UIcon name="i-lucide-search" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <button
          v-if="searchQuery"
          type="button"
          class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
          @click="searchQuery = ''"
        >
          <UIcon name="i-lucide-x" class="w-4 h-4" />
        </button>
        <button
          v-else
          type="button"
          class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
        >
          <UIcon name="i-lucide-volume-2" class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Sounds Grid -->
    <div class="flex-1 overflow-y-auto p-3">
      <div v-if="loading" class="flex items-center justify-center h-full">
        <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-gray-400" />
      </div>

      <div v-else-if="filteredSounds.length === 0" class="flex flex-col items-center justify-center h-full text-center p-8">
        <UIcon name="i-lucide-volume-x" class="w-16 h-16 text-gray-300 dark:text-gray-600 mb-3" />
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">
          {{ searchQuery ? 'No sounds found' : 'No sounds yet' }}
        </p>
        <button
          v-if="!searchQuery"
          type="button"
          class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          @click="showUploadModal = true"
        >
          Upload Sound
        </button>
      </div>

      <div v-else>
        <!-- Upload Button -->
        <button
          v-if="!searchQuery"
          type="button"
          class="w-full mb-3 p-3 rounded-lg bg-gray-800 dark:bg-gray-900 border-2 border-dashed border-gray-600 hover:border-gray-500 hover:bg-gray-750 dark:hover:bg-gray-850 transition-colors text-gray-400 hover:text-gray-300 flex items-center justify-center gap-2"
          @click="showUploadModal = true"
        >
          <UIcon name="i-lucide-plus" class="w-5 h-5" />
          <span class="text-sm font-medium">Add Sound</span>
        </button>

        <!-- Sounds Grid -->
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="sound in filteredSounds"
            :key="sound.id"
            type="button"
            class="group relative aspect-square rounded-lg bg-gray-800 dark:bg-gray-900 hover:bg-gray-700 dark:hover:bg-gray-850 transition-all duration-200 flex items-center justify-center p-2 overflow-hidden"
            @click="triggerSound(sound.id)"
          >
            <!-- Sound Name -->
            <div class="absolute inset-0 flex items-center justify-center p-2">
              <span class="text-xs font-medium text-white text-center wrap-break-word line-clamp-3">
                {{ sound.name }}
              </span>
            </div>

            <!-- Delete Button (Owner Only) -->
            <button
              v-if="canDeleteSound(sound)"
              type="button"
              class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded bg-red-600 hover:bg-red-700"
              @click.stop="deleteSound(sound.id)"
            >
              <UIcon name="i-lucide-trash-2" class="w-3 h-3 text-white" />
            </button>

            <!-- Owner Indicator -->
            <div
              v-if="canDeleteSound(sound)"
              class="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
              :title="sound.username"
            >
              <div class="w-2 h-2 rounded-full bg-green-500" />
            </div>
          </button>
        </div>
      </div>
    </div>
  </div>

  <Teleport v-if="showUploadModal" to="body">
    <div class="fixed inset-0 z-10000 flex items-center justify-center p-4 bg-black/50" @click.self="closeUploadModal">
      <div class="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-xl" @click.stop>
        <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            Upload Sound
          </h3>
          <button
            type="button"
            class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            @click="closeUploadModal"
          >
            <UIcon name="i-lucide-x" class="w-5 h-5" />
          </button>
        </div>

        <div class="p-4 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Sound Name <span class="text-red-500">*</span>
            </label>
            <input
              v-model="uploadName"
              type="text"
              placeholder="Enter sound name"
              :maxlength="50"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Audio File <span class="text-red-500">*</span>
            </label>
            <input
              type="file"
              accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/m4a,audio/aac"
              class="block w-full text-sm text-gray-500 dark:text-gray-400
                     file:mr-4 file:py-2 file:px-4
                     file:rounded-lg file:border-0
                     file:text-sm file:font-semibold
                     file:bg-blue-50 dark:file:bg-blue-900/20
                     file:text-blue-700 dark:file:text-blue-400
                     hover:file:bg-blue-100 dark:hover:file:bg-blue-900/30
                     file:cursor-pointer cursor-pointer"
              @change="handleFileSelect"
            >
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
              MP3, WAV, OGG, M4A, AAC • Max 10MB
            </p>
          </div>

          <div v-if="uploadFile && uploadDuration > 0" class="space-y-3">
            <div class="flex items-center justify-between">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
                Trim Audio
              </label>
              <div class="flex items-center gap-2">
                <span class="text-xs font-medium px-2 py-1 rounded bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400">
                  {{ formatTime(trimmedDuration) }}
                </span>
                <button
                  type="button"
                  class="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
                  :class="isPlaying ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400' : 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'"
                  @click="playPreview"
                >
                  <UIcon :name="isPlaying ? 'i-lucide-pause' : 'i-lucide-play'" class="inline w-3 h-3 mr-1" />
                  {{ isPlaying ? 'Stop' : 'Preview' }}
                </button>
              </div>
            </div>

            <div ref="waveformContainer" class="relative h-32 bg-gray-900 dark:bg-black rounded-lg overflow-hidden" />

            <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>{{ formatTime(trimStart) }}</span>
              <span>{{ formatTime(trimEnd) }}</span>
            </div>

            <p class="text-xs text-gray-500 dark:text-gray-400">
              Drag the green region to trim your audio (max 30s)
            </p>
          </div>
        </div>

        <div class="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            @click="closeUploadModal"
          >
            Cancel
          </button>
          <button
            type="button"
            :disabled="!uploadName.trim() || !uploadFile || uploading"
            class="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            @click="uploadSound"
          >
            {{ uploading ? 'Uploading...' : 'Upload' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
