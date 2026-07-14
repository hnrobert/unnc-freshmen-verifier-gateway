<script setup lang="ts">
definePageMeta({ layout: 'default' })
const route = useRoute()
const slug = computed(() => route.params.slug as string)
</script>

<template>
  <VerifyForm :slug="slug" />
</template>
