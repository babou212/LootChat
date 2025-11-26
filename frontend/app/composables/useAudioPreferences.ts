import type { AudioProfile } from '../../stores/webrtc'
import { useAppLogger } from './useLogger'

/**
 * Audio Preferences Persistence
 *
 * Manages localStorage persistence for audio settings including:
 * - Selected audio profile
 * - Selected audio device
 */

const STORAGE_KEY = 'lootchat_audio_preferences'

export interface AudioPreferences {
  profile: AudioProfile
  deviceId: string | null
  enableProcessing?: boolean
  processingPreset?: 'clean' | 'office' | 'noisy' | 'podcast'
}

const DEFAULT_PREFERENCES: AudioPreferences = {
  profile: 'balanced',
  deviceId: null,
  enableProcessing: false,
  processingPreset: 'office'
}

export const useAudioPreferences = () => {
  const logger = useAppLogger()

  /**
   * Load preferences from localStorage
   */
  const loadPreferences = (): AudioPreferences => {
    if (typeof window === 'undefined') {
      return DEFAULT_PREFERENCES
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) {
        logger.debug('No audio preferences found in localStorage')
        return DEFAULT_PREFERENCES
      }

      const parsed = JSON.parse(stored) as Partial<AudioPreferences>

      const preferences: AudioPreferences = {
        profile: parsed.profile || DEFAULT_PREFERENCES.profile,
        deviceId: parsed.deviceId !== undefined ? parsed.deviceId : DEFAULT_PREFERENCES.deviceId,
        enableProcessing: parsed.enableProcessing ?? DEFAULT_PREFERENCES.enableProcessing,
        processingPreset: parsed.processingPreset || DEFAULT_PREFERENCES.processingPreset
      }

      const validProfiles: AudioProfile[] = ['balanced', 'high-quality', 'bandwidth-saving', 'noise-canceling']
      if (!validProfiles.includes(preferences.profile)) {
        logger.warn(`Invalid audio profile in localStorage: ${preferences.profile}, using default`)
        preferences.profile = DEFAULT_PREFERENCES.profile
      }

      logger.info('Loaded audio preferences from localStorage', preferences)
      return preferences
    } catch (error) {
      logger.error('Failed to load audio preferences from localStorage', error)
      return DEFAULT_PREFERENCES
    }
  }

  /**
   * Save preferences to localStorage
   */
  const savePreferences = (preferences: Partial<AudioPreferences>): boolean => {
    if (typeof window === 'undefined') {
      return false
    }

    try {
      // Load existing preferences
      const existing = loadPreferences()

      // Merge with new preferences
      const updated: AudioPreferences = {
        ...existing,
        ...preferences
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      logger.info('Saved audio preferences to localStorage', updated)
      return true
    } catch (error) {
      logger.error('Failed to save audio preferences to localStorage', error)
      return false
    }
  }

  /**
   * Save audio profile preference
   */
  const saveProfile = (profile: AudioProfile): boolean => {
    return savePreferences({ profile })
  }

  /**
   * Save audio device preference
   */
  const saveDevice = (deviceId: string | null): boolean => {
    return savePreferences({ deviceId })
  }

  /**
   * Save processing preferences
   */
  const saveProcessing = (enable: boolean, preset?: 'clean' | 'office' | 'noisy' | 'podcast'): boolean => {
    return savePreferences({
      enableProcessing: enable,
      ...(preset && { processingPreset: preset })
    })
  }

  /**
   * Clear all preferences
   */
  const clearPreferences = (): boolean => {
    if (typeof window === 'undefined') {
      return false
    }

    try {
      localStorage.removeItem(STORAGE_KEY)
      logger.info('Cleared audio preferences from localStorage')
      return true
    } catch (error) {
      logger.error('Failed to clear audio preferences', error)
      return false
    }
  }

  /**
   * Get a single preference value
   */
  const getProfile = (): AudioProfile => {
    return loadPreferences().profile
  }

  const getDevice = (): string | null => {
    return loadPreferences().deviceId
  }

  const getProcessing = (): { enabled: boolean, preset: string } => {
    const prefs = loadPreferences()
    return {
      enabled: prefs.enableProcessing || false,
      preset: prefs.processingPreset || 'office'
    }
  }

  return {
    loadPreferences,
    savePreferences,
    saveProfile,
    saveDevice,
    saveProcessing,
    clearPreferences,
    getProfile,
    getDevice,
    getProcessing,
    DEFAULT_PREFERENCES
  }
}
