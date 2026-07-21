<script setup lang="ts">
import type { SiteConfig } from '#shared/types'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const slug = computed(() => route.params.slug as string)

// Page-level awaits (context-safe via Suspense); the results are handed to the
// sync useOrgDraft composable.
const { data: access } = await useFetch<{ role: string | null }>(
  () => `/api/orgs/${slug.value}/access`,
  { watch: [slug] },
)
const { data: raw } = await useAsyncData(
  () => `org-edit:${slug.value}`,
  () => useRequestFetch()<SiteConfig>(`/api/orgs/${slug.value}/config?edit=1`),
  { watch: [slug] },
)
if (!raw.value) throw createError({ statusCode: 404, statusMessage: 'Organization not found' })

const { isDirty, canEdit, saving, saved, confirmLeave, proceed, onSave, onDiscard } = useOrgDraft(
  raw.value,
  access,
)
</script>

<template>
  <div class="pb-24">
    <StatusAlert
      v-if="!canEdit"
      variant="error"
      message="You have view-only access to this organization. Changes can't be saved."
    />
    <ConfigEditor mode="basic" />

    <SaveBar
      v-if="canEdit"
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
