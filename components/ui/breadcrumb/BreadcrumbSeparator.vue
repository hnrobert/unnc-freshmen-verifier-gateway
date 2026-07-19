<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: HTMLAttributes['class'] }>()
</script>

<template>
  <!-- Plain "/" glyph instead of a lucide icon: a direct `import { Slash } from
       'lucide-vue-next'` renders fine in dev but resolves to null in the prod
       SSR bundle (null.ce). The registry-backed <Icon> is the prod-safe path,
       but a text separator avoids the dependency entirely. -->
  <li
    role="presentation"
    aria-hidden="true"
    :class="cn('select-none text-muted-foreground/60', props.class)"
  >
    /
  </li>
</template>
