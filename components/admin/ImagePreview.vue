<script setup lang="ts">
import { iconRegistry } from '~/lib/iconAllowlist'

const ImageOffIcon = iconRegistry['ImageOff']!
const props = defineProps<{ slug: string; src: string; imgStyle?: Record<string, string> }>()
const resolved = ref('')
const failed = ref(false)

const _imgCache = new Map<string, string>()

async function load(val: string) {
  failed.value = false
  resolved.value = ''
  if (!val) { failed.value = true; return }
  if (!val.startsWith('img:')) { resolved.value = val; return }
  const key = val.slice(4)
  const cacheKey = `${props.slug}:${key}`
  const cached = _imgCache.get(cacheKey)
  if (cached) { resolved.value = cached; return }
  try {
    const res = await $fetch<{ mime: string; base64: string }>(
      `/api/orgs/${props.slug}/img/${key}`,
      { query: { _t: Date.now() } },
    )
    const dataUrl = `data:${res.mime};base64,${res.base64}`
    _imgCache.set(cacheKey, dataUrl)
    resolved.value = dataUrl
  } catch {
    failed.value = true
  }
}

watch(() => props.src, (val) => load(val), { immediate: true })

defineExpose({
  refresh: () => {
    if (props.src?.startsWith('img:')) _imgCache.delete(`${props.slug}:${props.src.slice(4)}`)
    load(props.src)
  },
  failed: computed(() => failed.value),
  resolved: computed(() => resolved.value),
})
</script>

<template>
  <img
    v-if="resolved && !failed"
    :src="resolved"
    class="w-full border object-contain"
    :style="imgStyle"
    :class="$attrs.class as string"
    @error="failed = true"
  />
  <div
    v-else
    class="flex min-h-32 w-full items-center justify-center border bg-muted text-muted-foreground"
    :style="imgStyle"
    :class="$attrs.class as string"
  >
    <component :is="ImageOffIcon" :size="32" :stroke-width="1.5" />
  </div>
</template>
