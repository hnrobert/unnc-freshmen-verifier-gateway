<script setup lang="ts">
import type { Ref } from 'vue'
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
provide(OrgConfigKey, { config: draft })

// Load the draft's messages into vue-i18n so the live preview shows the org's
// labels (and re-merge on edits so the preview tracks changes live).
const { applyOrgI18n, mergeOrgMessages } = useOrgI18n()
applyOrgI18n(draft.value)
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
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Edit <code>/{{ slug }}</code></h1>
        <p class="mt-1 text-sm text-muted-foreground">Customize labels, images, welcome content, and gateway settings. Preview updates live.</p>
      </div>
      <div class="flex items-center gap-2">
        <a :href="`/${slug}`" target="_blank" :class="buttonVariants({ variant: 'ghost', size: 'sm' })">View ↗</a>
        <Button variant="outline" :disabled="saving" @click="onDiscard">Discard</Button>
        <Button :disabled="saving" @click="onSave">{{ saving ? 'Saving…' : 'Save' }}</Button>
      </div>
    </div>

    <StatusAlert v-if="saved" variant="success" message="Saved." class="mt-4" />
    <StatusAlert v-if="errors.length" variant="error" :message="errors.join('; ')" class="mt-4" />

    <div class="mt-6 grid gap-8 lg:grid-cols-2">
      <div class="order-2 lg:order-1"><ConfigEditor /></div>
      <div class="order-1 lg:order-2"><LivePreview /></div>
    </div>
  </div>
</template>
