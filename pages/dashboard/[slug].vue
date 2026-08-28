<script setup lang="ts">
import type { SiteConfig } from '#shared/types'
import { contrastFg } from '#shared/lib/color'

// Parent route for an page's dashboard area. The page tab bar + breadcrumb live
// in the dashboard layout; this page only renders the active panel via
// <NuxtPage />.
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const slug = computed(() => route.params.slug as string)

// The page's resolved config — same key/endpoint as the public layout, so the
// payload is shared between the public page, /preview, and the dashboard.
const { data: config } = await useAsyncData(
  () => `page:${slug.value}`,
  () => $fetch<SiteConfig>(`/api/pages/${slug.value}/config`),
  { watch: [slug] },
)

// Theme the org's dashboard area with its own brand color, by the same rule as
// the public page (--primary/--ring + luminance-picked foreground). Bound on
// this wrapper only: the dashboard chrome (sidebar, header) keeps the global
// theme, while everything inside — including the fixed save bar, which is
// position:fixed but still a DOM descendant and thus inherits the vars —
// follows the org color. --radius stays global (dashboard controls keep the
// site rounding).
const themeVars = computed(() => {
  const c = config.value?.theme.primaryColor ?? '#F7D447'
  return {
    '--primary': c,
    '--primary-foreground': contrastFg(c),
    '--ring': c,
  } as Record<string, string>
})
</script>

<template>
  <div :style="themeVars">
    <NuxtPage />
  </div>
</template>
