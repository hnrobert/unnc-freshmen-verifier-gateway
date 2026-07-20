<script setup lang="ts">
// Parent route for an org's dashboard area. The org tab bar + breadcrumb now live
// in the dashboard layout's sticky full-width header; this page only validates the
// org is accessible and renders the active panel (Home / Edit / Advanced / Members
// / Share) via <NuxtPage />.
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()

interface OrgRow {
  id: number
  slug: string
  name: string
  role: string
}
const { data } = await useFetch<{ orgs: OrgRow[] }>('/api/orgs')
const slug = computed(() => route.params.slug as string)
const current = computed(() => data.value?.orgs.find((o) => o.slug === slug.value))
if (!current.value) throw createError({ statusCode: 404, statusMessage: 'Organization not found' })
</script>

<template>
  <div>
    <NuxtPage />
  </div>
</template>
