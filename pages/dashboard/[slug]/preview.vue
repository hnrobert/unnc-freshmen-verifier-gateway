<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const slug = computed(() => route.params.slug as string)
</script>

<template>
  <div>
    <p class="mb-3 text-sm text-muted-foreground">
      Live preview of <code>/{{ slug }}</code> — the public verify page in mock mode (any
      well-formed input is admitted, so you can reach the welcome screen without the portal).
    </p>
    <!-- The original preview interface (the /<slug>/preview route) embedded in a
         frame, so the preview lives in this tab instead of being opened separately. -->
    <iframe
      :src="`/${slug}/preview`"
      title="Organization preview"
      class="h-[80vh] w-full rounded-lg border"
    />
  </div>
</template>
