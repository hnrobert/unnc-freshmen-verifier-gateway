<script setup lang="ts">
definePageMeta({ layout: 'default', middleware: 'preview-guard' })
const route = useRoute()
const slug = computed(() => route.params.slug as string)
</script>

<template>
  <VerifyForm
    :slug="slug"
    preview
    default-name="示例姓名"
    default-id="110100200801019999"
    :welcome-path="`/${slug}/preview/welcome`"
  />
</template>
