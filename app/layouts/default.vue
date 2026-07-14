<script setup lang="ts">
import type { Ref } from 'vue'
import type { SiteConfig } from '#shared/types'
import { OrgConfigKey } from '~/composables/useOrgConfig'

const route = useRoute()
const slug = computed(() => route.params.slug as string)

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
watchEffect(() => {
  if (config.value) applyOrgI18n(config.value)
})

const radius = computed(() => config.value?.theme.radius ?? '0.65rem')
useHead({ htmlAttrs: { style: () => `--radius: ${radius.value}` } })
</script>

<template>
  <div class="relative min-h-screen bg-background text-foreground">
    <div aria-hidden="true" class="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div class="absolute -top-40 left-1/2 size-[42rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"></div>
    </div>
    <header class="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-5 py-5">
      <BrandMark />
      <div class="flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>
    </header>
    <main class="mx-auto w-full max-w-2xl px-5 pb-16">
      <slot />
    </main>
    <footer class="mx-auto w-full max-w-2xl px-5 pb-10 text-center text-xs leading-relaxed text-muted-foreground">
      {{ $t('footer') }}
    </footer>
  </div>
</template>
