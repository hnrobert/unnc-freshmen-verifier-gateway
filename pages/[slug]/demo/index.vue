<script setup lang="ts">
// Per-org demo/preview route (owner-only): the real verify form pre-filled with
// sample data. Submitting jumps straight to the demo welcome page (no real
// portal check), so the org owner can preview the full flow + custom welcome.
definePageMeta({ layout: 'default', middleware: 'demo-guard' })
const route = useRoute()
const slug = computed(() => route.params.slug as string)
</script>

<template>
  <VerifyForm
    :slug="slug"
    demo
    default-name="示例姓名"
    default-id="110100200801019999"
    :welcome-path="`/${slug}/demo/welcome`"
  />
</template>
