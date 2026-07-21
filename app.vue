<script setup lang="ts">
import { useMutationObserver } from '@vueuse/core'

// The app's dark mode is driven by the `dark` class on <html> (toggled from the
// vg.theme storage key), not by the OS. Track that class so the floating toaster
// matches the app — vue-sonner otherwise defaults to a light theme.
const isDark = ref(false)
const toasterTheme = computed<'light' | 'dark'>(() => (isDark.value ? 'dark' : 'light'))
onMounted(() => {
  const el = document.documentElement
  isDark.value = el.classList.contains('dark')
  useMutationObserver(
    el,
    () => {
      isDark.value = el.classList.contains('dark')
    },
    { attributes: true, attributeFilter: ['class'] },
  )
})
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <Toaster position="top-right" rich-colors close-button :theme="toasterTheme" />
  </div>
</template>
