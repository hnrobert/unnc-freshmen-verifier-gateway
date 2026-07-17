<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { isImageIcon, resolveIcon } from '~/lib/icon'
import type { IconRef } from '#shared/types'

const props = withDefaults(
  defineProps<{ spec?: IconRef; size?: number | string; strokeWidth?: number; cover?: boolean }>(),
  { size: '1em', strokeWidth: 2, cover: false },
)

const route = useRoute()
const slug = computed(() => route.params.slug as string | undefined)

const isImg = computed(() => isImageIcon(props.spec))
const rawImg = computed(() => (isImg.value ? (props.spec as { img: string }).img : ''))
const comp = computed(() => (isImg.value ? null : resolveIcon(props.spec)))
const sizePx = computed(() => (typeof props.size === 'number' ? `${props.size}px` : props.size))

// Resolve img source: data URLs and regular URLs pass through; img:key refs
// are fetched as base64 JSON and converted to data URLs on the frontend.
const imgSrc = ref('')
watch(rawImg, (val) => {
  if (!val) { imgSrc.value = ''; return }
  if (!val.startsWith('img:')) { imgSrc.value = val; return }
  const key = val.slice(4)
  const s = slug.value
  if (!s) return
  // Check cache first
  const cached = (globalThis as Record<string, unknown>).__imgCache as Map<string, string> | undefined
  const cacheKey = `${s}:${key}`
  if (cached?.has(cacheKey)) { imgSrc.value = cached.get(cacheKey)!; return }
  // Fetch base64 JSON from the endpoint
  $fetch<{ mime: string; base64: string }>(`/api/orgs/${s}/img/${key}`)
    .then((res) => {
      const dataUrl = `data:${res.mime};base64,${res.base64}`
      imgSrc.value = dataUrl
    })
    .catch(() => {})
}, { immediate: true })
</script>

<template>
  <img
    v-if="isImg"
    :src="imgSrc"
    :style="cover ? {} : { width: sizePx, height: sizePx }"
    :class="cover ? 'size-full object-cover' : 'object-contain'"
    aria-hidden="true"
    alt=""
  />
  <component
    v-else-if="comp"
    :is="comp"
    :size="sizePx"
    :stroke-width="strokeWidth"
    aria-hidden="true"
  />
</template>
