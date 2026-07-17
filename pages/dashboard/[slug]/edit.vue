<script setup lang="ts">
import type { SiteConfig } from '#shared/types'
import { OrgConfigKey } from '~/composables/useOrgConfig'
import { buttonVariants } from '~/components/ui/button'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
const slug = computed(() => route.params.slug as string)

// Owner-only raw config (cookie forwarded on SSR via useRequestFetch).
const { data: raw } = await useAsyncData(`org-edit:${slug.value}`, () =>
  useRequestFetch()<SiteConfig>(`/api/orgs/${slug.value}/config?edit=1`),
)
if (!raw.value) throw createError({ statusCode: 404, statusMessage: 'Organization not found' })

// Mutable draft (deep-cloned so Discard can restore).
const draft = ref(JSON.parse(JSON.stringify(raw.value))) as Ref<SiteConfig>
// Backfill optional fields so the editor can bind to them (older seeded orgs).
if (!draft.value.background) draft.value.background = { overlayOpacity: 0.5 }
const wAny = draft.value.welcome as Record<string, unknown>
if (wAny.imageRounded !== undefined && wAny.imageRadius === undefined) {
  wAny.imageRadius = wAny.imageRounded ? '50%' : '0.5rem'
  delete wAny.imageRounded
}
if (!wAny.imageRadius) wAny.imageRadius = '0.5rem'
provide(OrgConfigKey, { config: draft })

// Load the draft's messages into vue-i18n so the live preview shows the org's
// labels (and re-merge on edits so the preview tracks changes live).
const { applyOrgI18n, mergeOrgMessages } = useOrgI18n()
const acceptLanguage = import.meta.server
  ? (useRequestHeaders(['accept-language'])['accept-language'] ?? '')
  : (typeof navigator !== 'undefined' ? navigator.language : '')
applyOrgI18n(draft.value, acceptLanguage)
watch(() => draft.value.messages, () => mergeOrgMessages(draft.value), { deep: true })

const saving = ref(false)
const saved = ref(false)
const errors = ref<string[]>([])

async function onSave(): Promise<void> {
  saving.value = true
  errors.value = []
  saved.value = false
  try {
    const v = await $fetch<{ errors: string[] }>('/api/orgs/validate', {
      method: 'POST',
      body: { config: draft.value },
    })
    if (v.errors.length) {
      errors.value = v.errors
      return
    }
    await $fetch(`/api/orgs/${slug.value}/config`, { method: 'PUT', body: { config: draft.value } })
    saved.value = true
    setTimeout(() => (saved.value = false), 2000)
  } catch (e) {
    errors.value = [messageFromError(e, 'Save failed')]
  } finally {
    saving.value = false
  }
}

function onDiscard(): void {
  if (!confirm('Discard unsaved changes?')) return
  draft.value = JSON.parse(JSON.stringify(raw.value))
}
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold tracking-tight sm:text-2xl">Edit <code>/{{ slug }}</code></h1>
        <p class="mt-1 hidden text-sm text-muted-foreground sm:block">Customize labels, images, welcome content, and gateway settings.</p>
      </div>
      <div class="flex items-center gap-2">
        <a :href="`/${slug}/demo`" target="_blank" :class="buttonVariants({ variant: 'ghost', size: 'sm' })">Demo ↗</a>
        <a :href="`/${slug}`" target="_blank" :class="buttonVariants({ variant: 'ghost', size: 'sm' })">View ↗</a>
        <Button variant="outline" :disabled="saving" class="sm:hidden" size="sm" @click="onDiscard">Reset</Button>
        <Button variant="outline" :disabled="saving" class="hidden sm:inline-flex" @click="onDiscard">Discard</Button>
        <Button :disabled="saving" size="sm" class="sm:hidden" @click="onSave">{{ saving ? '…' : 'Save' }}</Button>
        <Button :disabled="saving" class="hidden sm:inline-flex" @click="onSave">{{ saving ? 'Saving…' : 'Save' }}</Button>
      </div>
    </div>

    <!-- Sticky save bar on mobile -->
    <div class="sticky top-0 z-10 -mx-4 mb-4 flex items-center gap-2 border-b bg-background/95 px-4 py-2 backdrop-blur sm:hidden">
      <span class="text-xs text-muted-foreground">/{{ slug }}</span>
      <span class="ml-auto text-xs" :class="saved ? 'text-emerald-600' : 'text-muted-foreground'">{{ saved ? '✓ Saved' : errors.length ? `${errors.length} errors` : '' }}</span>
      <Button :disabled="saving" size="sm" @click="onSave">{{ saving ? '…' : 'Save' }}</Button>
    </div>

    <StatusAlert v-if="saved" variant="success" message="Saved." class="mt-4" />
    <StatusAlert v-if="errors.length" variant="error" :message="errors.join('; ')" class="mt-4" />

    <div class="mt-6">
      <ConfigEditor />
    </div>
  </div>
</template>
