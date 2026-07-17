<script setup lang="ts">
import type { SiteConfig } from '#shared/types'
import { OrgConfigKey } from '~/composables/useOrgConfig'

const route = useRoute()
const slug = computed(() => route.params.slug as string)
const isDemo = computed(() => route.path.split('/').filter(Boolean)[1] === 'preview')

// Load the org's resolved config (SSR-cached by slug). Reactive key + watch so
// cross-org navigation refetches.
const { data: config } = await useAsyncData(
  () => `org:${slug.value}`,
  () => $fetch<SiteConfig>(`/api/orgs/${slug.value}/config`),
  { watch: [slug] },
)
if (!config.value) throw createError({ statusCode: 404, statusMessage: 'Organization not found' })

provide(OrgConfigKey, { config: config as unknown as Ref<SiteConfig> })

const { applyOrgI18n } = useOrgI18n()
// Browser language for locale detection: Accept-Language on SSR, navigator on
// client — they match, so SSR renders the right locale on first paint (no flash).
const acceptLanguage = import.meta.server
  ? (useRequestHeaders(['accept-language'])['accept-language'] ?? '')
  : (typeof navigator !== 'undefined' ? navigator.language : '')
watchEffect(() => {
  if (config.value) applyOrgI18n(config.value, acceptLanguage)
})

const radius = computed(() => config.value?.theme.radius ?? '0.65rem')
const primaryColor = computed(() => config.value?.theme.primaryColor ?? '#F7D447')

// Per-org favicon: the org's brand icon. Image brands are already resolved to
// a data: / http URL by loadOrgConfig → resolveImageRefs, so link them directly;
// lucide brand names render to SVG via /api/icon.svg (in the org primary color).
const faviconHref = computed(() => {
  const brand = config.value?.icons.brand
  if (brand && typeof brand === 'object' && brand.img) return brand.img
  const name = typeof brand === 'string' ? brand : (brand?.lucide ?? 'GraduationCap')
  const params = new URLSearchParams({ name, color: primaryColor.value, strokeWidth: '2' })
  return `/api/icon.svg?${params}`
})
const faviconType = computed(() => {
  const href = faviconHref.value
  if (href.startsWith('data:')) return href.slice(5).split(';')[0] // e.g. image/png
  if (href.startsWith('/api/icon.svg')) return 'image/svg+xml'
  return undefined // remote/local image: let the browser sniff
})
useHead({
  link: [{ key: 'favicon', rel: 'icon', href: faviconHref, type: faviconType }],
})

function contrastFg(hex: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return '#1c1917'
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return 0.299 * r + 0.587 * g + 0.114 * b > 0.55 ? '#1c1917' : '#fafafa'
}

// CSS vars applied directly on the root div — avoids the flash caused by
// useHead htmlAttrs.style being applied after hydration on client refresh.
const themeVars = computed(() => {
  const c = primaryColor.value
  return {
    '--radius': radius.value,
    '--primary': c,
    '--primary-foreground': contrastFg(c),
    '--ring': c,
  } as Record<string, string>
})

// Read the optional background straight from the local config ref (a component
// can't inject its own provide; useOrgBackground is for descendants).
const bgImage = computed(() => config.value?.background?.image ?? '')
const hasBg = computed(() => !!bgImage.value)
const bgOverlay = computed(() => config.value?.background?.overlayOpacity ?? 0.5)
</script>

<template>
  <div class="relative min-h-screen text-foreground" :class="{ 'bg-background': !hasBg }" :style="themeVars">
    <!-- optional page background image + darkening overlay -->
    <div
      v-if="hasBg"
      aria-hidden="true"
      class="pointer-events-none fixed inset-0 -z-20 bg-cover bg-center bg-no-repeat"
      :style="{ backgroundImage: `url(${bgImage})` }"
    ></div>
    <div
      v-if="hasBg"
      aria-hidden="true"
      class="pointer-events-none fixed inset-0 -z-10 bg-white dark:bg-black"
      :style="{ opacity: bgOverlay }"
    ></div>
    <!-- default decorative blob (only without a background image) -->
    <div v-else aria-hidden="true" class="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div class="absolute -top-40 left-1/2 size-168 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"></div>
    </div>
    <header class="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-5 py-5">
      <BrandMark />
      <div class="flex items-center gap-2">
        <NuxtLink
          v-if="isDemo"
          :to="`/dashboard/${slug}/edit`"
          class="inline-flex size-7.25 items-center justify-center rounded-md border text-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Edit"
          title="Edit"
        >
          <Icon spec="Pencil" :size="15" />
        </NuxtLink>
        <LanguageToggle />
        <ThemeToggle />
      </div>
    </header>
    <main class="mx-auto w-full max-w-2xl px-5 pb-16">
      <slot />
    </main>
    <footer class="mx-auto w-full max-w-2xl px-5 pb-10 text-center text-xs leading-relaxed text-foreground/60">
      {{ $t('footer') }}
    </footer>
  </div>
</template>
