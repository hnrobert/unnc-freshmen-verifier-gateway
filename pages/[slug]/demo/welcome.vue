<script setup lang="ts">
// Demo welcome page (owner-only): same WelcomeContent as the real welcome, reached
// from the demo verify form. The welcome-gate + demo-guard middleware protect it.
definePageMeta({ layout: 'default', middleware: ['demo-guard', 'welcome-gate'] })
</script>

<template>
  <WelcomeContent />
</template>
