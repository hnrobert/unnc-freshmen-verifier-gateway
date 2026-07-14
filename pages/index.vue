<script setup lang="ts">
definePageMeta({ layout: false })
// Landing → dashboard (auth middleware bounces to /login if needed).
await navigateTo('/dashboard', { replace: true })
</script>

<template>
  <div class="p-10">Redirecting…</div>
</template>
