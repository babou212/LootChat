/**
 * Audio Preprocessing Utility
 * 
 * Provides Web Audio API-based audio processing including:
 * - High-pass/low-pass filters for background noise removal
 * - Dynamic range compression for consistent volume
 * - Noise gate for cutting audio below threshold
 * - Parametric EQ for voice enhancement
 */

export interface AudioProcessingConfig {
  enableFilters: boolean
  enableCompression: boolean
  enableNoiseGate: boolean
  
  // High-pass filter (removes low-frequency rumble)
  highPassFrequency: number // Hz, typically 80-100
  
  // Low-pass filter (removes high-frequency hiss)
  lowPassFrequency: number // Hz, typically 8000-12000
  
  // Compressor settings
  compressorThreshold: number // dB, typically -24 to -12
  compressorKnee: number // dB, typically 30
  compressorRatio: number // typically 12
  compressorAttack: number // seconds, typically 0.003
  compressorRelease: number // seconds, typically 0.25
  
  // Noise gate settings
  noiseGateThreshold: number // dB, typically -50 to -40
  
  // Voice EQ boost (presence range 2-5kHz)
  enableVoiceBoost: boolean
  voiceBoostFrequency: number // Hz, typically 3000
  voiceBoostGain: number // dB, typically 3-6
}

export const DEFAULT_AUDIO_PROCESSING: AudioProcessingConfig = {
  enableFilters: true,
  enableCompression: true,
  enableNoiseGate: true,
  highPassFrequency: 85,
  lowPassFrequency: 10000,
  compressorThreshold: -18,
  compressorKnee: 30,
  compressorRatio: 12,
  compressorAttack: 0.003,
  compressorRelease: 0.25,
  noiseGateThreshold: -45,
  enableVoiceBoost: true,
  voiceBoostFrequency: 3000,
  voiceBoostGain: 4
}

export class AudioProcessor {
  private audioContext: AudioContext
  private source: MediaStreamAudioSourceNode
  private destination: MediaStreamAudioDestinationNode
  
  // Audio nodes
  private highPassFilter?: BiquadFilterNode
  private lowPassFilter?: BiquadFilterNode
  private compressor?: DynamicsCompressorNode
  private noiseGate?: GainNode
  private voiceBoostEQ?: BiquadFilterNode
  
  // Analysis
  private analyser?: AnalyserNode
  private noiseGateCheckInterval?: number
  
  constructor(inputStream: MediaStream, config: AudioProcessingConfig = DEFAULT_AUDIO_PROCESSING) {
    this.audioContext = new AudioContext()
    this.source = this.audioContext.createMediaStreamSource(inputStream)
    this.destination = this.audioContext.createMediaStreamDestination()
    
    this.buildProcessingChain(config)
  }

  /**
   * Build the audio processing chain
   */
  private buildProcessingChain(config: AudioProcessingConfig) {
    let currentNode: AudioNode = this.source

    // High-pass filter (removes rumble, wind noise)
    if (config.enableFilters) {
      this.highPassFilter = this.audioContext.createBiquadFilter()
      this.highPassFilter.type = 'highpass'
      this.highPassFilter.frequency.value = config.highPassFrequency
      this.highPassFilter.Q.value = 0.7071 // Butterworth response
      currentNode.connect(this.highPassFilter)
      currentNode = this.highPassFilter
    }

    // Low-pass filter (removes hiss, electronic noise)
    if (config.enableFilters) {
      this.lowPassFilter = this.audioContext.createBiquadFilter()
      this.lowPassFilter.type = 'lowpass'
      this.lowPassFilter.frequency.value = config.lowPassFrequency
      this.lowPassFilter.Q.value = 0.7071
      currentNode.connect(this.lowPassFilter)
      currentNode = this.lowPassFilter
    }

    // Voice presence boost
    if (config.enableVoiceBoost) {
      this.voiceBoostEQ = this.audioContext.createBiquadFilter()
      this.voiceBoostEQ.type = 'peaking'
      this.voiceBoostEQ.frequency.value = config.voiceBoostFrequency
      this.voiceBoostEQ.Q.value = 1.4 // Moderate bandwidth
      this.voiceBoostEQ.gain.value = config.voiceBoostGain
      currentNode.connect(this.voiceBoostEQ)
      currentNode = this.voiceBoostEQ
    }

    // Dynamic range compressor (evens out volume)
    if (config.enableCompression) {
      this.compressor = this.audioContext.createDynamicsCompressor()
      this.compressor.threshold.value = config.compressorThreshold
      this.compressor.knee.value = config.compressorKnee
      this.compressor.ratio.value = config.compressorRatio
      this.compressor.attack.value = config.compressorAttack
      this.compressor.release.value = config.compressorRelease
      currentNode.connect(this.compressor)
      currentNode = this.compressor
    }

    // Noise gate (cuts audio below threshold)
    if (config.enableNoiseGate) {
      this.noiseGate = this.audioContext.createGain()
      this.noiseGate.gain.value = 1
      currentNode.connect(this.noiseGate)
      currentNode = this.noiseGate

      // Setup analyser for noise gate
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 512
      this.analyser.smoothingTimeConstant = 0.8
      currentNode.connect(this.analyser)

      // Start noise gate monitoring
      this.startNoiseGate(config.noiseGateThreshold)
    }

    // Connect to destination
    currentNode.connect(this.destination)
  }

  /**
   * Start noise gate monitoring
   */
  private startNoiseGate(threshold: number) {
    if (!this.analyser || !this.noiseGate) return

    const checkGate = () => {
      if (!this.analyser || !this.noiseGate) return

      const dataArray = new Uint8Array(this.analyser.frequencyBinCount)
      this.analyser.getByteFrequencyData(dataArray)
      
      const sum = dataArray.reduce((a, b) => a + b, 0)
      const average = sum / dataArray.length
      const level = average > 0 ? 20 * Math.log10(average / 255) : -100

      // Smooth gate transitions
      const targetGain = level > threshold ? 1 : 0
      const currentGain = this.noiseGate.gain.value
      
      // Exponential smoothing
      const smoothingFactor = targetGain > currentGain ? 0.1 : 0.05 // Faster attack, slower release
      this.noiseGate.gain.value = currentGain + (targetGain - currentGain) * smoothingFactor
    }

    // Check gate every 10ms
    this.noiseGateCheckInterval = window.setInterval(checkGate, 10)
  }

  /**
   * Update processing configuration
   */
  updateConfig(config: Partial<AudioProcessingConfig>) {
    if (config.highPassFrequency !== undefined && this.highPassFilter) {
      this.highPassFilter.frequency.value = config.highPassFrequency
    }

    if (config.lowPassFrequency !== undefined && this.lowPassFilter) {
      this.lowPassFilter.frequency.value = config.lowPassFrequency
    }

    if (config.enableVoiceBoost !== undefined && config.voiceBoostGain !== undefined && this.voiceBoostEQ) {
      this.voiceBoostEQ.gain.value = config.enableVoiceBoost ? config.voiceBoostGain : 0
    }

    if (config.voiceBoostFrequency !== undefined && this.voiceBoostEQ) {
      this.voiceBoostEQ.frequency.value = config.voiceBoostFrequency
    }

    if (this.compressor) {
      if (config.compressorThreshold !== undefined) {
        this.compressor.threshold.value = config.compressorThreshold
      }
      if (config.compressorKnee !== undefined) {
        this.compressor.knee.value = config.compressorKnee
      }
      if (config.compressorRatio !== undefined) {
        this.compressor.ratio.value = config.compressorRatio
      }
      if (config.compressorAttack !== undefined) {
        this.compressor.attack.value = config.compressorAttack
      }
      if (config.compressorRelease !== undefined) {
        this.compressor.release.value = config.compressorRelease
      }
    }
  }

  /**
   * Get the processed audio stream
   */
  getOutputStream(): MediaStream {
    return this.destination.stream
  }

  /**
   * Get the audio context (useful for connecting analysers)
   */
  getAudioContext(): AudioContext {
    return this.audioContext
  }

  /**
   * Get current audio level
   */
  getAudioLevel(): number {
    if (!this.analyser) return -100

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount)
    this.analyser.getByteFrequencyData(dataArray)
    const sum = dataArray.reduce((a, b) => a + b, 0)
    const average = sum / dataArray.length

    return average > 0 ? 20 * Math.log10(average / 255) : -100
  }

  /**
   * Bypass all processing (pass-through)
   */
  bypass(enabled: boolean) {
    if (enabled) {
      // Disconnect processing chain and connect source directly to destination
      this.source.disconnect()
      this.source.connect(this.destination)
    } else {
      // Rebuild processing chain
      // Note: This would require storing the config, which is a TODO
      console.warn('Unbypass not fully implemented - requires config storage')
    }
  }

  /**
   * Cleanup and disconnect all nodes
   */
  destroy() {
    if (this.noiseGateCheckInterval) {
      clearInterval(this.noiseGateCheckInterval)
    }

    // Disconnect all nodes
    this.source.disconnect()
    this.highPassFilter?.disconnect()
    this.lowPassFilter?.disconnect()
    this.voiceBoostEQ?.disconnect()
    this.compressor?.disconnect()
    this.noiseGate?.disconnect()
    this.analyser?.disconnect()
    this.destination.disconnect()

    // Close audio context
    if (this.audioContext.state !== 'closed') {
      this.audioContext.close()
    }
  }
}

/**
 * Preset configurations for different environments
 */
export const AUDIO_PROCESSING_PRESETS = {
  clean: {
    ...DEFAULT_AUDIO_PROCESSING,
    enableNoiseGate: false,
    enableVoiceBoost: false
  } as AudioProcessingConfig,

  office: {
    ...DEFAULT_AUDIO_PROCESSING,
    highPassFrequency: 100,
    noiseGateThreshold: -42,
    voiceBoostGain: 5
  } as AudioProcessingConfig,

  noisy: {
    ...DEFAULT_AUDIO_PROCESSING,
    highPassFrequency: 120,
    lowPassFrequency: 8000,
    noiseGateThreshold: -38,
    compressorRatio: 16,
    voiceBoostGain: 6
  } as AudioProcessingConfig,

  podcast: {
    ...DEFAULT_AUDIO_PROCESSING,
    highPassFrequency: 80,
    lowPassFrequency: 12000,
    compressorThreshold: -16,
    compressorRatio: 8,
    voiceBoostGain: 3,
    voiceBoostFrequency: 2500
  } as AudioProcessingConfig
}
