<script setup lang="ts">
import type { SiteConfig } from '#shared/types'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const slug = computed(() => route.params.slug as string)

// Page-level awaits (context-safe via Suspense); the results are handed to the
// sync usePageDraft composable.
const { data: access } = await useFetch<{ role: string | null; rank: number }>(
  () => `/api/pages/${slug.value}/access`,
  { watch: [slug] },
)
const { data: raw } = await useAsyncData(
  () => `page-edit:${slug.value}`,
  () => useRequestFetch()<SiteConfig>(`/api/pages/${slug.value}/config?edit=1`),
  { watch: [slug] },
)
if (!raw.value) throw createError({ statusCode: 404, statusMessage: 'Page not found' })

const { isDirty, canEdit, saving, saved, confirmLeave, proceed, onSave, onDiscard } = usePageDraft(
  raw.value,
  access,
)

// The Name & URL card renders its own SaveBar (separate save path) — track its
// dirty state so this page's config SaveBar can yield while it's up.
const nameCard = ref<{ isDirty: boolean } | null>(null)
const nameCardDirty = computed(() => !!nameCard.value?.isDirty)
</script>

<template>
  <div class="pb-24">
    <StatusAlert
      v-if="!canEdit"
      variant="error"
      message="You have view-only access to this page. Changes can't be saved."
    />
    <div class="space-y-8">
      <ConfigEditor mode="basic" />
      <PageNameSlugCard ref="nameCard" :key="slug" :slug="slug" />
    </div>

    <!-- Hidden while the Name & URL card has its own unsaved changes — two
         fixed bottom bars must never stack (the card renders its own SaveBar). -->
    <SaveBar
      v-if="canEdit && !nameCardDirty"
      :dirty="isDirty"
      :saving="saving"
      :saved="saved"
      @save="onSave"
      @discard="onDiscard"
    />
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
