<script setup lang="ts">
import { iconRegistry } from '~/lib/iconAllowlist'

const ImageOffIcon = iconRegistry['ImageOff']!
const props = defineProps<{ slug: string; src: string }>()
const resolved = ref('')
const failed = ref(false)

watch(() => props.src, (val) => {
  failed.value = false
  resolved.value = ''
  if (!val) { failed.value = true; return }
  if (!val.startsWith('img:')) { resolved.value = val; return }
  $fetch<{ mime: string; base64: string }>(`/api/orgs/${props.slug}/img/${val.slice(4)}`)
    .then((res) => { resolved.value = `data:${res.mime};base64,${res.base64}` })
    .catch(() => { failed.value = true })
}, { immediate: true })
</script>

<template>
  <!-- Image loaded -->
  <img
    v-if="resolved && !failed"
    :src="resolved"
    class="h-32 w-full rounded-lg border"
    :class="$attrs.class as string"
    @error="failed = true"
  />
  <!-- Placeholder -->
  <div
    v-else
    class="flex h-32 w-full items-center justify-center rounded-lg border bg-muted text-muted-foreground"
    :class="$attrs.class as string"
  >
    <component :is="ImageOffIcon" :size="32" :stroke-width="1.5" />
  </div>
</template>
