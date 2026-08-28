<script setup lang="ts">
import type { SiteConfig } from '#shared/types'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const slug = computed(() => route.params.slug as string)

const { data: access } = await useFetch<{ role: string | null }>(
  () => `/api/pages/${slug.value}/access`,
  { watch: [slug] },
)
const { data: raw } = await useAsyncData(
  () => `page-edit:${slug.value}`,
  () => useRequestFetch()<SiteConfig>(`/api/pages/${slug.value}/config?edit=1`),
  { watch: [slug] },
)
if (!raw.value) throw createError({ statusCode: 404, statusMessage: 'Page not found' })

const { isDirty, canEdit, onSave, onDiscard } = usePageDraft(raw.value, access)
</script>

<template>
  <div>
    <StatusAlert
      v-if="!canEdit"
      variant="error"
      message="You have view-only access to this page. Changes can't be saved."
    />
    <ConfigEditor mode="advanced" />

    <GuardedSave v-if="canEdit" :dirty="isDirty" :on-save="onSave" :on-discard="onDiscard" />
  </div>
</template>
