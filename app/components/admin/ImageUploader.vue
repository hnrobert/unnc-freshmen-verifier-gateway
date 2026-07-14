<script setup lang="ts">
const props = defineProps<{ slug: string; imageKey: string; label?: string }>()
const emit = defineEmits<{ uploaded: [ref: string] }>()

const uploading = ref(false)
const error = ref('')

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
  <div class="grid gap-1.5">
    <Label>{{ label ?? 'Upload image' }}</Label>
    <input
      type="file"
      accept="image/*"
      :disabled="uploading"
      class="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground"
      @change="onFile"
    />
    <p v-if="uploading" class="text-xs text-muted-foreground">Uploading…</p>
    <p v-if="error" class="text-xs text-destructive">{{ error }}</p>
  </div>
</template>
