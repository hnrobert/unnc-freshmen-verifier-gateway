<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  slug: string
  imageKey: string
  label?: string
  silent?: boolean
  /** Show a "delete current image" button next to Upload/Update. */
  hasExisting?: boolean
}>()
const emit = defineEmits<{
  uploaded: [payload: { ref: string; expiresAt: string | null }]
  deleted: []
}>()
const { t } = useI18n()

const uploading = ref(false)
const deleting = ref(false)
const error = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

function triggerUpload() {
  fileInput.value?.click()
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const s = String(reader.result)
      resolve(s.slice(s.indexOf(',') + 1))
    }
    reader.onerror = () => reject(new Error('read failed'))
    reader.readAsDataURL(file)
  })
}

async function onFile(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (file.size > 100_000_000) {
    error.value = 'File too large (max 100MB)'
    return
  }
  uploading.value = true
  error.value = ''
  try {
    const base64 = await fileToBase64(file)
    const res = await $fetch<{ ref?: string; expiresAt?: string | null }>(
      `/api/pages/${props.slug}/images`,
      { method: 'POST', body: { key: props.imageKey, mime: file.type, base64 } },
    )
    // When `silent`, the parent shows its own (combined) toast — e.g. the
    // welcome uploader folds the OCR result into a single message.
    if (!props.silent) toast.success(t('editor.imageUploaded'))
    emit('uploaded', {
      ref: res.ref ?? `img:${props.imageKey}`,
      expiresAt: res.expiresAt ?? null,
    })
  } catch (err) {
    error.value = messageFromError(err, 'Upload failed')
  } finally {
    uploading.value = false
    input.value = ''
  }
}

async function onDelete(): Promise<void> {
  if (!confirm(t('editor.deleteImageConfirm'))) return
  deleting.value = true
  error.value = ''
  try {
    // Endpoint is idempotent — a missing row (already deleted) is fine.
    await $fetch(`/api/pages/${props.slug}/images/${props.imageKey}`, { method: 'DELETE' })
    toast.success(t('editor.imageDeleted'))
    emit('deleted')
  } catch (err) {
    error.value = messageFromError(err, 'Delete failed')
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="grid gap-2">
    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      :disabled="uploading"
      class="hidden"
      @change="onFile"
    />
    <div class="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        :disabled="uploading || deleting"
        class="w-fit"
        @click="triggerUpload"
      >
        <Icon v-if="uploading" spec="LoaderCircle" :size="16" class="animate-spin" />
        <Icon v-else spec="Upload" :size="16" />
        {{ uploading ? 'Uploading…' : (label ?? 'Upload image') }}
      </Button>
      <Button
        v-if="hasExisting"
        type="button"
        variant="outline"
        size="sm"
        :disabled="uploading || deleting"
        class="w-fit text-destructive hover:bg-destructive/10 hover:text-destructive"
        @click="onDelete"
      >
        <Icon v-if="deleting" spec="LoaderCircle" :size="16" class="animate-spin" />
        <Icon v-else spec="Trash2" :size="16" />
        {{ t('editor.deleteImage') }}
      </Button>
    </div>
    <p v-if="error" class="text-xs text-destructive">{{ error }}</p>
  </div>
</template>
