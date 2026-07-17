<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { isImageIcon, resolveIcon } from '~/lib/icon'
import { iconRegistry } from '~/lib/iconAllowlist'
import type { IconRef } from '#shared/types'

const FALLBACK_ICON = iconRegistry['CircleHelp']!
const IMAGE_ERROR_ICON = iconRegistry['ImageOff']!

const props = withDefaults(
  defineProps<{ spec?: IconRef; size?: number | string; strokeWidth?: number; cover?: boolean }>(),
  { size: '1em', strokeWidth: 2, cover: false },
)

const route = useRoute()
const slug = computed(() => route.params.slug as string | undefined)

const isImg = computed(() => isImageIcon(props.spec))
const rawImg = computed(() => (isImg.value ? (props.spec as { img: string }).img : ''))
const lucideComp = computed(() => (isImg.value ? null : resolveIcon(props.spec) ?? FALLBACK_ICON))
const sizePx = computed(() => (typeof props.size === 'number' ? `${props.size}px` : props.size))

// Image loading state
const imgSrc = ref('')
const imgError = ref(false)

watch(rawImg, (val) => {
  imgError.value = false
  if (!val) { imgSrc.value = ''; return }
  if (!val.startsWith('img:')) { imgSrc.value = val; return }
  const key = val.slice(4)
  const s = slug.value
  if (!s) { imgError.value = true; return }
  $fetch<{ mime: string; base64: string }>(`/api/orgs/${s}/img/${key}`)
    .then((res) => { imgSrc.value = `data:${res.mime};base64,${res.base64}` })
    .catch(() => { imgError.value = true })
}, { immediate: true })

// Show lucide icon if: not an image, image errored, or image still loading
const showFallback = computed(() => !isImg.value || imgError.value || !imgSrc.value)
const fallbackComp = computed(() => imgError.value ? IMAGE_ERROR_ICON : lucideComp.value ?? FALLBACK_ICON)
</script>

<template>
  <img
    v-if="isImg && !imgError && imgSrc"
    :src="imgSrc"
    :style="cover ? {} : { width: sizePx, height: sizePx }"
    :class="cover ? 'size-full object-cover' : 'object-contain'"
    aria-hidden="true"
    alt=""
    @error="imgError = true"
  />
  <component
    v-else
    :is="fallbackComp"
    :size="sizePx"
    :stroke-width="strokeWidth"
    aria-hidden="true"
  />
</template>
