<script setup lang="ts">
definePageMeta({ layout: 'default' })
const route = useRoute()
const slug = computed(() => route.params.slug as string)

// Count one page view per real load (client-only; the track endpoint records a
// 'view' event for this org). Fire-and-forget — analytics must never block render.
onMounted(() => {
  $fetch(`/api/orgs/${slug.value}/track`, { method: 'POST' }).catch(() => {})
})
</script>

<template>
  <VerifyForm :slug="slug" />
</template>
