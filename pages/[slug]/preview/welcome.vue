<script setup lang="ts">
definePageMeta({ layout: 'default', middleware: ['preview-guard', 'welcome-gate'] })
</script>

<template>
  <WelcomeContent />
</template>
