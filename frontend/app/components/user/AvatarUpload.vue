<script setup lang="ts">
defineProps<{
  currentAvatar?: string | null
}>()

const emit = defineEmits<{
  uploaded: [avatarUrl: string]
  error: [message: string]
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const previewUrl = ref<string | null>(null)
const uploading = ref(false)
const cropperCanvas = ref<HTMLCanvasElement | null>(null)
const previewImage = ref<HTMLImageElement | null>(null)

const cropData = reactive({
  offsetX: 0,
  offsetY: 0,
  scale: 1,
  imageWidth: 0,
  imageHeight: 0
})

const isDragging = ref(false)
const dragStart = { x: 0, y: 0 }

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) return

  if (!file.type.startsWith('image/')) {
    emit('error', 'Please select an image file')
    return
  }

  if (file.size > 5 * 1024 * 1024) {
    emit('error', 'Image size must be less than 5MB')
    return
  }

  selectedFile.value = file
  previewUrl.value = URL.createObjectURL(file)
}

const initCropper = () => {
  if (!previewImage.value || !cropperCanvas.value) return

  const img = previewImage.value
  const canvas = cropperCanvas.value

  canvas.width = 300
  canvas.height = 300

  // Calculate scale to fit image to circle
  const circleSize = 300
  const minDimension = Math.min(img.naturalWidth, img.naturalHeight)
  cropData.scale = circleSize / minDimension
  cropData.imageWidth = img.naturalWidth
  cropData.imageHeight = img.naturalHeight

  // Center the image
  cropData.offsetX = (circleSize - img.naturalWidth * cropData.scale) / 2
  cropData.offsetY = (circleSize - img.naturalHeight * cropData.scale) / 2

  drawCroppedImage()
}

const drawCroppedImage = () => {
  if (!previewImage.value || !cropperCanvas.value) return

  const img = previewImage.value
  const canvas = cropperCanvas.value
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  ctx.save()
  ctx.drawImage(
    img,
    cropData.offsetX,
    cropData.offsetY,
    cropData.imageWidth * cropData.scale,
    cropData.imageHeight * cropData.scale
  )
  ctx.restore()

  ctx.save()
  ctx.globalCompositeOperation = 'destination-in'
  ctx.beginPath()
  ctx.arc(150, 150, 150, 0, Math.PI * 2)
  ctx.closePath()
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.strokeStyle = '#3b82f6'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(150, 150, 150, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

const handleImageLoad = () => {
  initCropper()
}

const handleMouseDown = (event: MouseEvent) => {
  if (!cropperCanvas.value) return
  isDragging.value = true
  const rect = cropperCanvas.value.getBoundingClientRect()
  dragStart.x = event.clientX - rect.left - cropData.offsetX
  dragStart.y = event.clientY - rect.top - cropData.offsetY
  cropperCanvas.value.style.cursor = 'grabbing'
}

const handleMouseMove = (event: MouseEvent) => {
  if (!isDragging.value || !cropperCanvas.value) return

  const rect = cropperCanvas.value.getBoundingClientRect()
  cropData.offsetX = event.clientX - rect.left - dragStart.x
  cropData.offsetY = event.clientY - rect.top - dragStart.y

  drawCroppedImage()
}

const handleMouseUp = () => {
  isDragging.value = false
  if (cropperCanvas.value) {
    cropperCanvas.value.style.cursor = 'grab'
  }
}

const handleUpload = async () => {
  if (!selectedFile.value || !previewImage.value) return

  uploading.value = true

  try {
    const finalCanvas = document.createElement('canvas')
    finalCanvas.width = 200
    finalCanvas.height = 200
    const finalCtx = finalCanvas.getContext('2d')

    if (!finalCtx) {
      throw new Error('Failed to create canvas context')
    }

    const scaleFactor = 200 / 300

    finalCtx.save()
    finalCtx.drawImage(
      previewImage.value,
      cropData.offsetX * scaleFactor,
      cropData.offsetY * scaleFactor,
      cropData.imageWidth * cropData.scale * scaleFactor,
      cropData.imageHeight * cropData.scale * scaleFactor
    )
    finalCtx.globalCompositeOperation = 'destination-in'
    finalCtx.beginPath()
    finalCtx.arc(100, 100, 100, 0, Math.PI * 2)
    finalCtx.fill()
    finalCtx.restore()

    const blob = await new Promise<Blob>((resolve, reject) => {
      finalCanvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Failed to create blob'))
      }, 'image/png', 0.95)
    })

    const formData = new FormData()
    formData.append('avatar', blob, 'avatar.png')

    const response = await $fetch<{ avatarUrl: string }>('/api/users/avatar', {
      method: 'POST',
      body: formData
    })

    emit('uploaded', response.avatarUrl)
    cancelEdit()
  } catch (err) {
    console.error('Failed to upload avatar:', err)
    emit('error', err instanceof Error ? err.message : 'Failed to upload avatar')
  } finally {
    uploading.value = false
  }
}

const cancelEdit = () => {
  selectedFile.value = null
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = null
  }
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

const triggerFileInput = () => {
  fileInput.value?.click()
}

onMounted(() => {
  if (import.meta.client) {
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('mousemove', handleMouseMove)
  }
})

onUnmounted(() => {
  if (import.meta.client) {
    window.removeEventListener('mouseup', handleMouseUp)
    window.removeEventListener('mousemove', handleMouseMove)
  }
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
  }
})
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center gap-4">
      <div class="relative">
        <img
          v-if="currentAvatar"
          :src="currentAvatar"
          alt="Current avatar"
          class="w-24 h-24 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700"
        >
        <div
          v-else
          class="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center"
        >
          <UIcon name="i-lucide-user" class="text-4xl text-gray-400 dark:text-gray-500" />
        </div>
      </div>

      <div>
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          class="hidden"
          @change="handleFileSelect"
        >
        <UButton
          v-if="!selectedFile"
          color="primary"
          icon="i-lucide-upload"
          @click="triggerFileInput"
        >
          Upload Avatar
        </UButton>
        <p class="text-sm text-gray-600 dark:text-gray-400 mt-2">
          Maximum size: 5MB. Image will be cropped to a circle.
        </p>
      </div>
    </div>

    <div v-if="selectedFile" class="space-y-4">
      <div class="flex justify-center">
        <div class="relative inline-block">
          <canvas
            ref="cropperCanvas"
            class="border-2 border-blue-500 dark:border-blue-400 rounded-lg cursor-grab active:cursor-grabbing"
            @mousedown="handleMouseDown"
          />
          <img
            v-if="previewUrl"
            ref="previewImage"
            :src="previewUrl"
            class="hidden"
            @load="handleImageLoad"
          >
        </div>
      </div>

      <p class="text-sm text-gray-600 dark:text-gray-400 text-center">
        Drag the image to reposition it within the circle
      </p>

      <div class="flex justify-center gap-2">
        <UButton
          color="neutral"
          variant="ghost"
          @click="cancelEdit"
        >
          Cancel
        </UButton>
        <UButton
          color="primary"
          :loading="uploading"
          :disabled="uploading"
          @click="handleUpload"
        >
          Upload
        </UButton>
      </div>
    </div>
  </div>
</template>
