<script setup lang="ts">
interface Props {
  showDetails?: boolean
  showMetrics?: boolean
  compact?: boolean
}

withDefaults(defineProps<Props>(), {
  showDetails: true,
  showMetrics: false,
  compact: false
})

const store = useWebRTC()

const isInVoiceChannel = computed(() => store.currentChannelId.value !== null)

const qualityMetrics = computed(() => ({
  quality: 'excellent' as 'excellent' | 'good' | 'poor' | 'disconnected',
  avgRtt: 0,
  avgPacketLoss: 0,
  avgBitrate: 0,
  avgJitter: 0
}))

const quality = computed(() => qualityMetrics.value.quality)

const qualityClass = computed(() => {
  if (!isInVoiceChannel.value) return ''
  return `quality-${quality.value}`
})

const qualityText = computed(() => {
  switch (quality.value) {
    case 'excellent':
      return 'Excellent'
    case 'good':
      return 'Good'
    case 'poor':
      return 'Poor'
    case 'disconnected':
      return 'Disconnected'
    default:
      return 'Unknown'
  }
})

const qualityIcon = computed(() => {
  switch (quality.value) {
    case 'excellent':
      return 'i-lucide-signal'
    case 'good':
      return 'i-lucide-signal'
    case 'poor':
      return 'i-lucide-signal-low'
    case 'disconnected':
      return 'i-lucide-signal-zero'
    default:
      return 'i-lucide-signal'
  }
})

const latencyText = computed(() => {
  const rtt = qualityMetrics.value.avgRtt
  const ms = Math.round(rtt * 1000)
  return `${ms}ms`
})

const packetLossText = computed(() => {
  const loss = Math.round(qualityMetrics.value.avgPacketLoss)
  return `${loss} lost`
})

const tooltipText = computed(() => {
  if (!isInVoiceChannel.value) return ''

  const rtt = Math.round(qualityMetrics.value.avgRtt * 1000)
  const loss = Math.round(qualityMetrics.value.avgPacketLoss)
  const bitrate = Math.round(qualityMetrics.value.avgBitrate / 1000)
  const jitter = (qualityMetrics.value.avgJitter * 1000).toFixed(1)

  return `Quality: ${qualityText.value}\nLatency: ${rtt}ms\nPacket Loss: ${loss}\nBitrate: ${bitrate} Kbps\nJitter: ${jitter}ms`
})
</script>

<template>
  <div
    v-if="isInVoiceChannel"
    class="voice-quality-indicator"
    :class="qualityClass"
    :title="tooltipText"
  >
    <div class="quality-icon">
      <UIcon :name="qualityIcon" />
    </div>
    <div v-if="showDetails" class="quality-details">
      <span class="quality-label">{{ qualityText }}</span>
      <span v-if="showMetrics" class="quality-metrics">
        {{ latencyText }} • {{ packetLossText }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.voice-quality-indicator {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.3s ease;
  cursor: help;
}

.quality-icon {
  display: flex;
  align-items: center;
  font-size: 1.125rem;
  animation: pulse 2s ease-in-out infinite;
}

.quality-details {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.quality-label {
  font-weight: 600;
  line-height: 1.2;
}

.quality-metrics {
  font-size: 0.75rem;
  opacity: 0.8;
  line-height: 1.2;
}

/* Quality States */
.quality-excellent {
  background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
  color: #065f46;
  border: 1px solid #6ee7b7;
}

.quality-excellent .quality-icon {
  color: #059669;
}

.quality-good {
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  color: #1e40af;
  border: 1px solid #93c5fd;
}

.quality-good .quality-icon {
  color: #2563eb;
}

.quality-poor {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  color: #92400e;
  border: 1px solid #fcd34d;
}

.quality-poor .quality-icon {
  color: #d97706;
  animation: pulse-warning 1.5s ease-in-out infinite;
}

.quality-disconnected {
  background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
  color: #991b1b;
  border: 1px solid #fca5a5;
}

.quality-disconnected .quality-icon {
  color: #dc2626;
  animation: pulse-error 1s ease-in-out infinite;
}

/* Animations */
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

@keyframes pulse-warning {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.1);
  }
}

@keyframes pulse-error {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.15);
  }
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .quality-excellent {
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(16, 185, 129, 0.15) 100%);
    color: #6ee7b7;
    border-color: rgba(16, 185, 129, 0.3);
  }

  .quality-good {
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(59, 130, 246, 0.15) 100%);
    color: #93c5fd;
    border-color: rgba(59, 130, 246, 0.3);
  }

  .quality-poor {
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(245, 158, 11, 0.15) 100%);
    color: #fcd34d;
    border-color: rgba(245, 158, 11, 0.3);
  }

  .quality-disconnected {
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(239, 68, 68, 0.15) 100%);
    color: #fca5a5;
    border-color: rgba(239, 68, 68, 0.3);
  }
}

/* Responsive */
@media (max-width: 640px) {
  .voice-quality-indicator {
    padding: 0.375rem 0.5rem;
    font-size: 0.8125rem;
  }

  .quality-icon {
    font-size: 1rem;
  }

  .quality-metrics {
    display: none;
  }
}
</style>
