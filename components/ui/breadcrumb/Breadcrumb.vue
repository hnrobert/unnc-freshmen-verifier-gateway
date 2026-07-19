<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: HTMLAttributes['class'] }>()
</script>

<template>
  <nav aria-label="breadcrumb" :class="cn('relative w-full', props.class)">
    <slot />
  </nav>
</template>
