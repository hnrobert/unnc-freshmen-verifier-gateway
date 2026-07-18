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
  : typeof navigator !== 'undefined'
    ? navigator.language
    : ''
applyOrgI18n(draft.value, acceptLanguage)
watch(
  () => draft.value.messages,
  () => mergeOrgMessages(draft.value),
  { deep: true },
)

const saving = ref(false)
const saved = ref(false)

// --- Dirty tracking ---
const originalSerialized = ref(JSON.stringify(raw.value))
const isDirty = computed(() => JSON.stringify(draft.value) !== originalSerialized.value)

// --- Navigation guard (unsaved-changes prompt on leave) ---
const { confirmLeave, proceed } = useUnsavedLeaveGuard(isDirty, saving)

// Returns true on a successful save (used by saveAndPreview to open the preview).
async function onSave(): Promise<boolean> {
  saving.value = true
  saved.value = false
  try {
    const v = await $fetch<{ errors: string[] }>('/api/orgs/validate', {
      method: 'POST',
      body: { config: draft.value },
    })
    if (v.errors.length) {
      toast.error(v.errors.join('; '))
      return false
    }
    await $fetch(`/api/orgs/${slug.value}/config`, { method: 'PUT', body: { config: draft.value } })
    originalSerialized.value = JSON.stringify(draft.value)
    saved.value = true
    setTimeout(() => (saved.value = false), 2000)
    return true
  } catch (e) {
    toast.error(messageFromError(e, 'Save failed'))
    return false
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
  const ok = await onSave()
  if (ok) {
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
    <div
      class="sticky top-14 z-30 -mx-4 mb-4 flex flex-wrap items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur lg:top-0 lg:-mx-6 lg:px-6"
    >
      <h1 class="text-xl font-semibold tracking-tight sm:text-2xl">
        Edit <code>/{{ slug }}</code>
      </h1>
      <div class="flex items-center gap-2">
        <Button variant="ghost" size="sm" @click="onPreviewClick">Preview ↗</Button>
        <a
          :href="`/${slug}`"
          target="_blank"
          :class="buttonVariants({ variant: 'ghost', size: 'sm' })"
          >Visit ↗</a
        >
      </div>
    </div>

    <div class="mt-6 pb-24">
      <ConfigEditor />
    </div>

    <!-- Sticky save/discard bar (dirty tracking + save logic live in this page) -->
    <SaveBar :dirty="isDirty" :saving="saving" :saved="saved" @save="onSave" @discard="onDiscard" />

    <!-- Preview with unsaved changes dialog -->
    <Transition name="fade">
      <div
        v-if="previewDialog"
        class="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4"
        @click.self="previewDialog = false"
      >
        <Card class="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Unsaved changes</CardTitle>
            <CardDescription
              >You have unsaved changes. Save before previewing to see them
              reflected?</CardDescription
            >
          </CardHeader>
          <CardContent class="flex flex-col gap-2">
            <Button class="w-full" :disabled="saving" @click="saveAndPreview"
              >Save & Preview</Button
            >
            <Button variant="outline" class="w-full" @click="previewWithoutSaving"
              >Preview without saving</Button
            >
            <Button variant="ghost" class="w-full" @click="previewDialog = false">Cancel</Button>
          </CardContent>
        </Card>
      </div>
    </Transition>

    <!-- Unsaved changes leave dialog -->
    <UnsavedLeaveDialog
      :open="confirmLeave"
      :saving="saving"
      @stay="confirmLeave = false"
      @discard="
        () => {
          onDiscard()
          proceed()
        }
      "
      @save="
        async () => {
          await onSave()
          proceed()
        }
      "
    />
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
