<script setup lang="ts">
import { iconRegistry } from '~/lib/iconAllowlist'
import type { IconRef } from '#shared/types'

const props = defineProps<{ slug: string; modelValue: IconRef; slotName: string }>()
const emit = defineEmits<{ 'update:modelValue': [IconRef] }>()

const allNames = Object.keys(iconRegistry)
const open = ref(false)
const query = ref('')
const showUpload = ref(false)
const imgPreviewRef = ref<{ refresh: () => void } | null>(null)

const isImg = computed(() => typeof props.modelValue === 'object' && !!props.modelValue.img)
const imgRef = computed(() => (isImg.value ? (props.modelValue as { img: string }).img : ''))
const lucideName = computed(() => (typeof props.modelValue === 'string' ? props.modelValue : ''))

const filtered = computed(() => {
  const q = query.value.toLowerCase()
  const list = q ? allNames.filter((n) => n.toLowerCase().includes(q)) : allNames
  return list.slice(0, 60)
})

function pickLucide(name: string): void {
  emit('update:modelValue', name)
  open.value = false
  query.value = ''
}

function onText(name: string | number): void {
  emit('update:modelValue', String(name))
}

function onUploaded(ref: string): void {
  emit('update:modelValue', { img: ref })
  showUpload.value = false
  // Refresh the preview after a short delay (wait for DB write)
  setTimeout(() => imgPreviewRef.value?.refresh(), 200)
}
</script>

<template>
  <div class="grid gap-1.5">
    <Label>{{ slotName }}</Label>
    <div v-if="!isImg" class="flex items-center gap-2">
      <span class="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border">
        <Icon :spec="modelValue" :size="18" :cover="isImg" />
      </span>
      <Input
        :model-value="lucideName"
        placeholder="lucide name"
        class="h-9"
        @update:model-value="onText"
      />
      <Button size="sm" variant="outline" type="button" @click="open = !open">Browse</Button>
    </div>

    <!-- Custom image preview -->
    <div v-if="isImg && imgRef" class="flex items-center gap-2">
      <div class="size-16 shrink-0">
        <ImagePreview
          ref="imgPreviewRef"
          :slug="slug"
          :src="imgRef"
          :img-style="{ borderRadius: '0.5rem', width: '4rem', height: '4rem' }"
          class="size-16 object-cover"
        />
      </div>
      <div class="flex flex-col gap-1">
        <span class="text-xs text-muted-foreground">Using image: <code>{{ imgRef }}</code></span>
        <Button size="sm" variant="ghost" type="button" class="w-fit" @click="pickLucide('CircleHelp')">Switch to icon</Button>
      </div>
    </div>

    <div v-if="open" class="max-h-44 overflow-auto rounded-md border p-2">
      <Input v-model="query" placeholder="search icons…" class="mb-2 h-8" />
      <div class="grid grid-cols-8 gap-1">
        <button
          v-for="name in filtered"
          :key="name"
          type="button"
          :title="name"
          class="flex items-center justify-center rounded p-1.5 hover:bg-accent"
          @click="pickLucide(name)"
        >
          <Icon :spec="name" :size="18" />
        </button>
      </div>
    </div>

    <button type="button" class="w-fit text-xs text-muted-foreground underline" @click="showUpload = !showUpload">
      or upload a custom image
    </button>
    <ImageUploader
      v-if="showUpload"
      :slug="slug"
      :image-key="slotName"
      label="Custom icon image"
      @uploaded="onUploaded"
    />
  </div>
</template>
