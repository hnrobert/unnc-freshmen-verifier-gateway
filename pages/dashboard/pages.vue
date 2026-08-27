<script setup lang="ts">
import { buttonVariants } from '~/components/ui/button'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

interface PageItem {
  id: number
  slug: string
  name: string
  role: string
}
const { data, pending } = await useFetch<{ pages: PageItem[] }>('/api/pages')

// Split the viewer's pages into the two relationships: pages they own vs. pages
// they were invited to as a collaborator. `/api/pages` returns the real role
// ('owner' even for a superadmin's own pages; 'manager'|'editor'|'viewer' for
// collaborations), so the grouping is authoritative.
const owned = computed(() =>
  (data.value?.pages ?? []).filter((o) => o.role === 'owner' || o.role === 'superadmin'),
)
const collaborated = computed(() =>
  (data.value?.pages ?? []).filter((o) => !['owner', 'superadmin'].includes(o.role)),
)
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold tracking-tight sm:text-2xl">Your pages</h1>
        <p class="mt-1 text-sm text-muted-foreground">
          Each page has its own verify gateway at <code>/&lt;slug&gt;</code>.
        </p>
      </div>
      <Button @click="navigateTo('/dashboard/new')">New page</Button>
    </div>

    <div v-if="pending" class="mt-10 text-muted-foreground">Loading…</div>

    <div
      v-else-if="!data?.pages?.length"
      class="mt-10 rounded-lg border border-dashed p-12 text-center"
    >
      <p class="text-muted-foreground">No pages yet.</p>
      <Button class="mt-4" @click="navigateTo('/dashboard/new')">Create your first page</Button>
    </div>

    <div v-else class="mt-6 space-y-10">
      <!-- Orgs the viewer owns -->
      <section v-if="owned.length">
        <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Owner <span class="font-normal text-muted-foreground/60">· {{ owned.length }}</span>
        </h2>
        <ul class="space-y-2">
          <li
            v-for="page in owned"
            :key="page.id"
            class="flex items-center justify-between gap-3 rounded-lg border p-4"
          >
            <NuxtLink :to="`/dashboard/${page.slug}`" class="truncate font-medium underline">{{
              page.name
            }}</NuxtLink>
            <div class="flex shrink-0 items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                @click="navigateTo(`/dashboard/${page.slug}/share`)"
                >Share</Button
              >
              <a
                :href="`/${page.slug}`"
                target="_blank"
                :class="buttonVariants({ variant: 'ghost', size: 'sm' })"
                >View ↗</a
              >
            </div>
          </li>
        </ul>
      </section>

      <!-- Orgs the viewer was invited to as a collaborator -->
      <section v-if="collaborated.length">
        <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Collaborator
          <span class="font-normal text-muted-foreground/60">· {{ collaborated.length }}</span>
        </h2>
        <ul class="space-y-2">
          <li
            v-for="page in collaborated"
            :key="page.id"
            class="flex items-center justify-between gap-3 rounded-lg border p-4"
          >
            <div class="flex min-w-0 items-center gap-2">
              <NuxtLink :to="`/dashboard/${page.slug}`" class="truncate font-medium underline">{{
                page.name
              }}</NuxtLink>
              <span class="text-xs capitalize text-muted-foreground/70">{{ page.role }}</span>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                @click="navigateTo(`/dashboard/${page.slug}/share`)"
                >Share</Button
              >
              <a
                :href="`/${page.slug}`"
                target="_blank"
                :class="buttonVariants({ variant: 'ghost', size: 'sm' })"
                >View ↗</a
              >
            </div>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
