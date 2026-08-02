<script setup lang="ts">
import { buttonVariants } from '~/components/ui/button'

definePageMeta({ layout: 'dashboard', middleware: ['auth', 'superadmin'] })

interface OrgRow {
  id: number
  slug: string
  name: string
  createdAt: string
  ownerId: number
  ownerEmail: string
}

const { data: orgs } = await useFetch<OrgRow[]>('/api/admin/orgs')

// Group orgs by owner (stable key on ownerId, label on ownerEmail).
const grouped = computed(() => {
  const map = new Map<string, { ownerId: number; ownerEmail: string; orgs: OrgRow[] }>()
  for (const o of orgs.value ?? []) {
    const key = String(o.ownerId)
    const g = map.get(key) ?? { ownerId: o.ownerId, ownerEmail: o.ownerEmail, orgs: [] }
    g.orgs.push(o)
    map.set(key, g)
  }
  return [...map.values()]
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-semibold tracking-tight sm:text-2xl">All Organizations</h1>
      <p class="mt-1 text-sm text-muted-foreground">Site-wide analytics, grouped by owner.</p>
    </div>

    <!-- All-orgs overview (KPIs + trend) -->
    <StatsOverview
      endpoint="/api/admin/stats/overview"
      :show-org-cards="false"
      org-link-base="/dashboard/admin/organisations"
    />

    <!-- Org cards grouped by owner (unified card format) -->
    <section v-for="g in grouped" :key="g.ownerId" class="space-y-2">
      <h2 class="text-sm font-medium text-muted-foreground">{{ g.ownerEmail }}</h2>
      <ul class="space-y-2">
        <li
          v-for="org in g.orgs"
          :key="org.id"
          class="flex items-center justify-between gap-3 rounded-lg border p-4"
        >
          <NuxtLink
            :to="`/dashboard/admin/organisations/${org.slug}`"
            class="min-w-0 truncate font-medium hover:underline"
            >{{ org.name }}</NuxtLink
          >
          <div class="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              @click="navigateTo(`/dashboard/admin/organisations/${org.slug}/share`)"
              >Share</Button
            >
            <a
              :href="`/${org.slug}`"
              target="_blank"
              rel="noopener"
              :class="buttonVariants({ variant: 'ghost', size: 'sm' })"
              >View ↗</a
            >
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>
