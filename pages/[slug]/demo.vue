<script setup lang="ts">
// Per-org demo/preview route: the real verify form pre-filled with sample data.
// Submitting jumps straight to the welcome page (no real portal check), so the
// org owner can preview the full flow + their custom welcome content.
definePageMeta({ layout: 'default' })
const route = useRoute()
const slug = computed(() => route.params.slug as string)
</script>

<template>
  <VerifyForm :slug="slug" demo default-name="示例姓名" default-id="110100200801019999" />
</template>
