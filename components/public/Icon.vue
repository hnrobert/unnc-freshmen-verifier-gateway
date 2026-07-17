<script setup lang="ts">
import { computed } from 'vue'
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

// Resolve img:<key> refs to serving URLs (in the editor, config has raw refs;
// in public pages, refs are already resolved server-side).
const imgSrc = computed(() => {
  if (!rawImg.value) return ''
  if (rawImg.value.startsWith('img:') && slug.value) {
    return `/api/orgs/${slug.value}/img/${rawImg.value.slice(4)}`
  }
  return rawImg.value
})

const comp = computed(() => (isImg.value ? null : resolveIcon(props.spec)))
const sizePx = computed(() => (typeof props.size === 'number' ? `${props.size}px` : props.size))
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
