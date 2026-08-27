<script setup lang="ts">
import { buttonVariants } from '~/components/ui/button'

definePageMeta({ layout: 'dashboard', middleware: ['auth', 'superadmin'] })

interface PageRow {
  id: number
  slug: string
  name: string
  createdAt: string
  ownerId: number
  ownerEmail: string
}

const { data: pages } = await useFetch<PageRow[]>('/api/admin/pages')

// Group pages by owner (stable key on ownerId, label on ownerEmail).
const grouped = computed(() => {
  const map = new Map<string, { ownerId: number; ownerEmail: string; pages: PageRow[] }>()
  for (const o of pages.value ?? []) {
    const key = String(o.ownerId)
    const g = map.get(key) ?? { ownerId: o.ownerId, ownerEmail: o.ownerEmail, pages: [] }
    g.pages.push(o)
    map.set(key, g)
  }
  return [...map.values()]
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-semibold tracking-tight sm:text-2xl">All Pages</h1>
      <p class="mt-1 text-sm text-muted-foreground">Every page on the site, grouped by owner.</p>
    </div>

    <section v-for="g in grouped" :key="g.ownerId" class="space-y-2">
      <h2 class="text-sm font-medium text-muted-foreground">{{ g.ownerEmail }}</h2>
      <ul class="space-y-2">
        <li
          v-for="page in g.pages"
          :key="page.id"
          class="flex items-center justify-between gap-3 rounded-lg border p-4"
        >
          <NuxtLink
            :to="`/dashboard/admin/pages/${page.slug}`"
            class="min-w-0 truncate font-medium hover:underline"
            >{{ page.name }}</NuxtLink
          >
          <div class="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              @click="navigateTo(`/dashboard/admin/pages/${page.slug}/share`)"
              >Share</Button
            >
            <a
              :href="`/${page.slug}`"
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
