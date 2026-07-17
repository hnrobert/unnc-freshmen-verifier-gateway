<script setup lang="ts">
import type { SiteConfig } from '#shared/types'
import { OrgConfigKey } from '~/composables/useOrgConfig'
import { buttonVariants } from '~/components/ui/button'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
const slug = computed(() => route.params.slug as string)

const { data: raw } = await useAsyncData(`org-edit:${slug.value}`, () =>
  useRequestFetch()<SiteConfig>(`/api/orgs/${slug.value}/config?edit=1`),
)
if (!raw.value) throw createError({ statusCode: 404, statusMessage: 'Organization not found' })

const draft = ref(JSON.parse(JSON.stringify(raw.value))) as Ref<SiteConfig>
const wAny = draft.value.welcome as Record<string, unknown>
if (wAny.imageRounded !== undefined && wAny.imageRadius === undefined) {
  wAny.imageRadius = wAny.imageRounded ? '50%' : '0.5rem'
  delete wAny.imageRounded
}
if (!wAny.imageRadius) wAny.imageRadius = '0.5rem'
if (!draft.value.background) draft.value.background = { overlayOpacity: 0.5 }
provide(OrgConfigKey, { config: draft })

const { applyOrgI18n, mergeOrgMessages } = useOrgI18n()
const acceptLanguage = import.meta.server
  ? (useRequestHeaders(['accept-language'])['accept-language'] ?? '')
  : (typeof navigator !== 'undefined' ? navigator.language : '')
applyOrgI18n(draft.value, acceptLanguage)
watch(() => draft.value.messages, () => mergeOrgMessages(draft.value), { deep: true })

const saving = ref(false)
const saved = ref(false)
const errors = ref<string[]>([])

// --- Dirty tracking ---
const originalSerialized = ref(JSON.stringify(raw.value))
const isDirty = computed(() => JSON.stringify(draft.value) !== originalSerialized.value)

// --- Navigation guard ---
const confirmLeave = ref(false)
onBeforeRouteLeave(() => {
  if (isDirty.value && !saving.value && !saved.value) {
    confirmLeave.value = true
    return false
  }
})

async function onSave(): Promise<void> {
  saving.value = true
  errors.value = []
  saved.value = false
  try {
    const v = await $fetch<{ errors: string[] }>('/api/orgs/validate', {
      method: 'POST',
      body: { config: draft.value },
    })
    if (v.errors.length) { errors.value = v.errors; return }
    await $fetch(`/api/orgs/${slug.value}/config`, { method: 'PUT', body: { config: draft.value } })
    originalSerialized.value = JSON.stringify(draft.value)
    saved.value = true
    setTimeout(() => (saved.value = false), 2000)
  } catch (e) {
    errors.value = [messageFromError(e, 'Save failed')]
  } finally {
    saving.value = false
  }
}

function onDiscard(): void {
  draft.value = JSON.parse(JSON.stringify(raw.value))
  originalSerialized.value = JSON.stringify(raw.value)
}

// --- Preview dialog ---
const previewDialog = ref(false)

function onPreviewClick() {
  if (isDirty.value) {
    previewDialog.value = true
  } else {
    window.open(`/${slug.value}/preview`, '_blank')
  }
}

async function saveAndPreview() {
  previewDialog.value = false
  await onSave()
  if (!errors.value.length) {
    window.open(`/${slug.value}/preview`, '_blank')
  }
}

function previewWithoutSaving() {
  previewDialog.value = false
  window.open(`/${slug.value}/preview`, '_blank')
}
</script>

<template>
  <div>
    <!-- Sticky header bar -->
    <div class="sticky top-14 z-30 -mx-4 mb-4 flex flex-wrap items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur lg:top-0 lg:-mx-6 lg:px-6">
      <h1 class="text-xl font-semibold tracking-tight sm:text-2xl">Edit <code>/{{ slug }}</code></h1>
      <div class="flex items-center gap-2">
        <Button variant="ghost" size="sm" @click="onPreviewClick">Preview ↗</Button>
        <a :href="`/${slug}`" target="_blank" :class="buttonVariants({ variant: 'ghost', size: 'sm' })">Visit ↗</a>
      </div>
    </div>

    <StatusAlert v-if="saved" variant="success" message="Saved." class="mt-4" />
    <StatusAlert v-if="errors.length" variant="error" :message="errors.join('; ')" class="mt-4" />

    <div class="mt-6 pb-24">
      <ConfigEditor />
    </div>

    <!-- Discord-style save bar -->
    <Transition name="savebar">
      <div
        v-if="isDirty || saved"
        class="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur lg:left-64"
      >
        <div class="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <span class="text-sm text-muted-foreground">
            <template v-if="saved">✓ Saved</template>
            <template v-else>You have unsaved changes</template>
          </span>
          <div class="flex items-center gap-2">
            <Button variant="outline" size="sm" :disabled="saving || saved" @click="onDiscard">Discard</Button>
            <Button size="sm" :disabled="saving || saved" @click="onSave">{{ saving ? 'Saving…' : saved ? 'Saved' : 'Save changes' }}</Button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Preview with unsaved changes dialog -->
    <Transition name="fade">
      <div v-if="previewDialog" class="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4" @click.self="previewDialog = false">
        <Card class="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Unsaved changes</CardTitle>
            <CardDescription>You have unsaved changes. Save before previewing to see them reflected?</CardDescription>
          </CardHeader>
          <CardContent class="flex flex-col gap-2">
            <Button class="w-full" :disabled="saving" @click="saveAndPreview">Save & Preview</Button>
            <Button variant="outline" class="w-full" @click="previewWithoutSaving">Preview without saving</Button>
            <Button variant="ghost" class="w-full" @click="previewDialog = false">Cancel</Button>
          </CardContent>
        </Card>
      </div>
    </Transition>

    <!-- Unsaved changes leave dialog -->
    <Transition name="fade">
      <div v-if="confirmLeave" class="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4" @click.self="confirmLeave = false">
        <Card class="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Unsaved changes</CardTitle>
            <CardDescription>Save or discard before leaving?</CardDescription>
          </CardHeader>
          <CardContent class="flex gap-2">
            <Button variant="outline" class="flex-1" @click="confirmLeave = false">Stay</Button>
            <Button variant="outline" class="flex-1" @click="() => { onDiscard(); confirmLeave = false }">Discard</Button>
            <Button class="flex-1" :disabled="saving" @click="async () => { await onSave(); confirmLeave = false }">Save & leave</Button>
          </CardContent>
        </Card>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.savebar-enter-active, .savebar-leave-active { transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s; }
.savebar-enter-from, .savebar-leave-to { transform: translateY(100%); opacity: 0; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
