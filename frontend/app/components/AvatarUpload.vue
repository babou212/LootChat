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
const showCropDialog = ref(false)
const cropperCanvas = ref<HTMLCanvasElement | null>(null)
const previewImage = ref<HTMLImageElement | null>(null)

const cropData = {
  x: 0,
  y: 0,
  size: 0,
  scale: 1
}

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
  showCropDialog.value = true
}

const initCropper = () => {
  if (!previewImage.value || !cropperCanvas.value) return

  const img = previewImage.value
  const canvas = cropperCanvas.value
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  canvas.width = 300
  canvas.height = 300

  const imgAspect = img.naturalWidth / img.naturalHeight
  if (imgAspect > 1) {
    // Landscape
    cropData.size = img.naturalHeight
    cropData.x = (img.naturalWidth - cropData.size) / 2
    cropData.y = 0
  } else {
    cropData.size = img.naturalWidth
    cropData.x = 0
    cropData.y = (img.naturalHeight - cropData.size) / 2
  }

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
  ctx.beginPath()
  ctx.arc(150, 150, 150, 0, Math.PI * 2)
  ctx.closePath()
  ctx.clip()

  ctx.drawImage(
    img,
    cropData.x,
    cropData.y,
    cropData.size,
    cropData.size,
    0,
    0,
    300,
    300
  )
  ctx.restore()
}

const handleImageLoad = () => {
  initCropper()
}

const handleUpload = async () => {
  if (!selectedFile.value || !cropperCanvas.value) return

  uploading.value = true

  try {
    const finalCanvas = document.createElement('canvas')
    finalCanvas.width = 200
    finalCanvas.height = 200
    const finalCtx = finalCanvas.getContext('2d')

    if (!finalCtx || !previewImage.value) {
      throw new Error('Failed to create canvas context')
    }

    finalCtx.save()
    finalCtx.beginPath()
    finalCtx.arc(100, 100, 100, 0, Math.PI * 2)
    finalCtx.closePath()
    finalCtx.clip()

    finalCtx.drawImage(
      previewImage.value,
      cropData.x,
      cropData.y,
      cropData.size,
      cropData.size,
      0,
      0,
      200,
      200
    )
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
    closeDialog()
  } catch (err) {
    console.error('Failed to upload avatar:', err)
    emit('error', err instanceof Error ? err.message : 'Failed to upload avatar')
  } finally {
    uploading.value = false
  }
}

const closeDialog = () => {
  showCropDialog.value = false
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

    <UModal v-model="showCropDialog">
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">
              Crop Avatar
            </h3>
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-x"
              @click="closeDialog"
            />
          </div>
        </template>

        <div class="space-y-4">
          <div class="flex justify-center">
            <div class="relative">
              <canvas
                ref="cropperCanvas"
                class="border-2 border-gray-300 dark:border-gray-600 rounded-lg"
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
            Preview of your circular avatar
          </p>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              @click="closeDialog"
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
        </template>
      </UCard>
    </UModal>
  </div>
</template>
