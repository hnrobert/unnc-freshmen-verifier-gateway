<script setup lang="ts">
const props = defineProps<{ slug: string; imageKey: string; label?: string }>()
const emit = defineEmits<{ uploaded: [ref: string] }>()

const uploading = ref(false)
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
  if (file.size > 1_000_000) {
    error.value = 'File too large (max 1MB)'
    return
  }
  uploading.value = true
  error.value = ''
  try {
    const base64 = await fileToBase64(file)
    await $fetch(`/api/orgs/${props.slug}/images`, {
      method: 'POST',
      body: { key: props.imageKey, mime: file.type, base64 },
    })
    emit('uploaded', `img:${props.imageKey}`)
  } catch (err) {
    error.value = messageFromError(err, 'Upload failed')
  } finally {
    uploading.value = false
    input.value = ''
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
    <Button type="button" variant="outline" size="sm" :disabled="uploading" class="w-fit" @click="triggerUpload">
      <svg v-if="uploading" viewBox="0 0 24 24" class="size-4 animate-spin" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
      <svg v-else viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" /></svg>
      {{ uploading ? 'Uploading…' : (label ?? 'Upload image') }}
    </Button>
    <p v-if="error" class="text-xs text-destructive">{{ error }}</p>
  </div>
</template>
