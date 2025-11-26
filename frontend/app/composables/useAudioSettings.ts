import { useWebRTCStore, type AudioProfile, AUDIO_PROFILES } from '~/stores/webrtc'
import { useAppLogger } from './useLogger'

/**
 * Audio Settings Composable
 * 
 * Provides an interface for managing audio quality settings including:
 * - Audio profiles (balanced, high-quality, bandwidth-saving, noise-canceling)
 * - Audio device selection
 * - Advanced audio processing options
 */
export const useAudioSettings = () => {
  const store = useWebRTCStore()
  const logger = useAppLogger()

  // Computed properties
  const currentProfile = computed(() => store.audioProfile)
  const availableProfiles = computed(() => Object.keys(AUDIO_PROFILES) as AudioProfile[])
  const audioDevices = computed(() => store.availableAudioDevices)
  const selectedDevice = computed(() => store.selectedAudioDevice)
  const currentConstraints = computed(() => store.currentAudioConstraints)

  /**
   * Get profile configuration details
   */
  const getProfileDetails = (profile: AudioProfile) => {
    const config = AUDIO_PROFILES[profile]
    return {
      name: profile,
      sampleRate: config.sampleRate,
      channels: config.channelCount,
      echoCancellation: config.echoCancellation,
      noiseSuppression: typeof config.noiseSuppression === 'object' 
        ? config.noiseSuppression.ideal 
        : config.noiseSuppression,
      autoGainControl: config.autoGainControl,
      latency: config.latency,
      description: getProfileDescription(profile)
    }
  }

  /**
   * Get human-readable description of audio profile
   */
  const getProfileDescription = (profile: AudioProfile): string => {
    switch (profile) {
      case 'balanced':
        return 'Good balance between quality and bandwidth usage. Recommended for most users.'
      case 'high-quality':
        return 'Maximum audio quality with stereo output. Uses more bandwidth.'
      case 'bandwidth-saving':
        return 'Reduced bandwidth usage for slower connections. Lower quality.'
      case 'noise-canceling':
        return 'Maximum noise suppression for noisy environments. Slightly higher latency.'
      default:
        return ''
    }
  }

  /**
   * Set audio profile
   */
  const setProfile = async (profile: AudioProfile) => {
    try {
      logger.info(`Switching audio profile to: ${profile}`)
      store.setAudioProfile(profile)
      logger.info('Audio profile updated successfully')
      return true
    } catch (error) {
      logger.error('Failed to set audio profile', error)
      return false
    }
  }

  /**
   * Enumerate available audio devices
   */
  const refreshDevices = async () => {
    try {
      logger.debug('Enumerating audio devices...')
      const devices = await store.enumerateAudioDevices()
      logger.info(`Found ${devices.length} audio input device(s)`)
      return devices
    } catch (error) {
      logger.error('Failed to enumerate audio devices', error)
      return []
    }
  }

  /**
   * Select audio input device
   */
  const selectDevice = async (deviceId: string | null) => {
    try {
      logger.info(`Selecting audio device: ${deviceId || 'default'}`)
      await store.selectAudioDevice(deviceId)
      logger.info('Audio device switched successfully')
      return true
    } catch (error) {
      logger.error('Failed to switch audio device', error)
      return false
    }
  }

  /**
   * Request microphone permissions and enumerate devices
   */
  const requestPermissions = async () => {
    try {
      logger.debug('Requesting microphone permissions...')
      
      // Request a temporary stream to trigger permission prompt
      const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      // Stop the temporary stream immediately
      tempStream.getTracks().forEach(track => track.stop())
      
      // Now enumerate devices (they will have labels after permission is granted)
      await refreshDevices()
      
      logger.info('Microphone permissions granted')
      return true
    } catch (error) {
      logger.error('Microphone permission denied', error)
      return false
    }
  }

  /**
   * Get recommended profile based on connection quality
   */
  const getRecommendedProfile = (): AudioProfile => {
    const quality = store.averageConnectionQuality
    
    switch (quality) {
      case 'excellent':
        return 'high-quality'
      case 'good':
        return 'balanced'
      case 'poor':
        return 'bandwidth-saving'
      default:
        return 'balanced'
    }
  }

  /**
   * Auto-adjust profile based on connection quality
   */
  const autoAdjustProfile = async () => {
    const recommended = getRecommendedProfile()
    if (recommended !== store.audioProfile) {
      logger.info(`Auto-adjusting profile from ${store.audioProfile} to ${recommended}`)
      await setProfile(recommended)
      return recommended
    }
    return null
  }

  /**
   * Test audio input level
   */
  const testAudioLevel = async (durationMs: number = 3000): Promise<number[]> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: currentConstraints.value 
      })
      
      const context = new AudioContext()
      const source = context.createMediaStreamSource(stream)
      const analyser = context.createAnalyser()
      analyser.fftSize = 512
      source.connect(analyser)
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      const samples: number[] = []
      
      const startTime = Date.now()
      const sampleInterval = 100 // Sample every 100ms
      
      return new Promise((resolve) => {
        const sampleAudio = () => {
          if (Date.now() - startTime >= durationMs) {
            // Cleanup
            stream.getTracks().forEach(track => track.stop())
            context.close()
            resolve(samples)
            return
          }
          
          analyser.getByteFrequencyData(dataArray)
          const sum = dataArray.reduce((a, b) => a + b, 0)
          const average = sum / dataArray.length
          const level = average > 0 ? 20 * Math.log10(average / 255) : -100
          samples.push(level)
          
          setTimeout(sampleAudio, sampleInterval)
        }
        
        sampleAudio()
      })
    } catch (error) {
      logger.error('Failed to test audio level', error)
      return []
    }
  }

  return {
    // State
    currentProfile,
    availableProfiles,
    audioDevices,
    selectedDevice,
    currentConstraints,
    
    // Methods
    getProfileDetails,
    getProfileDescription,
    setProfile,
    refreshDevices,
    selectDevice,
    requestPermissions,
    getRecommendedProfile,
    autoAdjustProfile,
    testAudioLevel
  }
}
