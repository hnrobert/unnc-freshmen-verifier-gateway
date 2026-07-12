<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { cn } from '@/lib/utils'
import Icon from '@/components/Icon.vue'
import type { IconRef } from '@/shared/types'

const props = withDefaults(
  defineProps<{
    variant: 'error' | 'success' | 'info'
    message: string
    icon?: IconRef
    class?: HTMLAttributes['class']
  }>(),
  {},
)

const styles = computed(
  () =>
    ({
      error: 'border-destructive/30 bg-destructive/10 text-destructive',
      success:
        'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
      info: 'border-border bg-muted text-muted-foreground',
    })[props.variant],
)
</script>

<template>
  <div
    :class="cn('flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm', styles, props.class)"
    role="status"
  >
    <Icon v-if="props.icon" :spec="props.icon" :size="18" class="mt-0.5 shrink-0" />
    <span class="leading-relaxed">{{ props.message }}</span>
  </div>
</template>
