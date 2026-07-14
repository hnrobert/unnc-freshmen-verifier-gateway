<script setup lang="ts">
import { iconRegistry } from '~/lib/iconAllowlist'
import type { IconRef } from '#shared/types'

const props = defineProps<{ slug: string; modelValue: IconRef; slotName: string }>()
const emit = defineEmits<{ 'update:modelValue': [IconRef] }>()

const allNames = Object.keys(iconRegistry)
const open = ref(false)
const query = ref('')
const showUpload = ref(false)

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
}
</script>

<template>
  <div class="grid gap-1.5">
    <Label>{{ slotName }}</Label>
    <div class="flex items-center gap-2">
      <span class="flex size-8 items-center justify-center rounded-md border">
        <Icon :spec="modelValue" :size="18" />
      </span>
      <Input
        :model-value="lucideName"
        placeholder="lucide name"
        class="h-9"
        @update:model-value="onText"
      />
      <Button size="sm" variant="outline" type="button" @click="open = !open">Browse</Button>
    </div>

    <div v-if="isImg" class="text-xs text-muted-foreground">
      Using image: <code>{{ imgRef }}</code>
      <button type="button" class="ml-2 underline" @click="pickLucide('CircleHelp')">use icon</button>
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
