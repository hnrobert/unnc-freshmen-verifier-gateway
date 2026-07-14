<script setup lang="ts">
/**
 * Renders markdown source into sanitized HTML with auto-linked URLs/emails.
 * Raw HTML in the source is escaped (markdown-it `html: false`), so it is safe
 * to bind via `v-html` for user-authored welcome content.
 */
import { computed } from 'vue'
import { renderMarkdown } from '@/lib/markdown'

const props = defineProps<{ source: string }>()
const html = computed(() => renderMarkdown(props.source))
</script>

<template>
  <div class="vg-prose" v-html="html"></div>
</template>
