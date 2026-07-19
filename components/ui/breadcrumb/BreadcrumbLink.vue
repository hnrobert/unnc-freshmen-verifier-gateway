<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{
  to?: string
  href?: string
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <!-- Plain <a> for internal links too: <NuxtLink> resolves to null inside this
       nested auto-imported component during prod SSR (null.ce). Breadcrumbs
       navigating via full page load is fine. -->
  <a v-if="to" :href="to" :class="cn('transition-colors hover:text-foreground', props.class)">
    <slot />
  </a>
  <a
    v-else-if="href"
    :href="href"
    :class="cn('transition-colors hover:text-foreground', props.class)"
  >
    <slot />
  </a>
  <span v-else :class="cn('transition-colors hover:text-foreground', props.class)">
    <slot />
  </span>
</template>
