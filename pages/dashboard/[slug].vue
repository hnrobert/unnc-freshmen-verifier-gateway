<script setup lang="ts">
// Parent route for an org's dashboard area. The org tab bar + breadcrumb live
// in the dashboard layout; this page only renders the active panel via
// <NuxtPage />.
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
</script>

<template>
  <div>
    <NuxtPage />
  </div>
</template>
