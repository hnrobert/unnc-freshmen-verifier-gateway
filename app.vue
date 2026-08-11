<script setup lang="ts">
import { useMutationObserver } from '@vueuse/core'
import { SITE_TITLE } from '#shared/lib/site'

// One rule for every browser tab title, owned in a single place:
//   • the homepage (which sets SITE_TITLE) and any untitled page → just the
//     site name;
//   • any page that sets its own title (e.g. an org's brand title via the
//     default layout) → "{title} · UNNC Freshmen Verifier Gateway".
// This unifies org + homepage tab titles without each layout re-implementing
// the format.
useHead({
  titleTemplate: (title?: string) =>
    !title || title === SITE_TITLE ? SITE_TITLE : `${title} · ${SITE_TITLE}`,
})

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
