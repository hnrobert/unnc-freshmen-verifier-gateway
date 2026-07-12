<script setup lang="ts">
/**
 * Renders a customizable icon reference: a lucide-vue-next component (by name) or
 * a custom image URL. Driven entirely by `config/site.config.ts` → `icons`.
 */
import { computed } from 'vue'
import { isImageIcon, resolveIcon } from '@/lib/icon'
import type { IconRef } from '@/shared/types'

const props = withDefaults(
  defineProps<{ spec?: IconRef; size?: number | string; strokeWidth?: number }>(),
  { size: '1em', strokeWidth: 2 },
)

const isImg = computed(() => isImageIcon(props.spec))
const imgSrc = computed(() => (isImg.value ? (props.spec as { img: string }).img : ''))
const comp = computed(() => (isImg.value ? null : resolveIcon(props.spec)))
const sizePx = computed(() => (typeof props.size === 'number' ? `${props.size}px` : props.size))
</script>

<template>
  <img
    v-if="isImg"
    :src="imgSrc"
    :style="{ width: sizePx, height: sizePx }"
    class="object-contain"
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
