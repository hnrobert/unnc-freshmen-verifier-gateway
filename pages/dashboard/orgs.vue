<script setup lang="ts">
import { buttonVariants } from '~/components/ui/button'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

interface OrgItem {
  id: number
  slug: string
  name: string
  role: string
}
const { data, pending } = await useFetch<{ orgs: OrgItem[] }>('/api/orgs')

// Split the viewer's orgs into the two relationships: orgs they own vs. orgs
// they were invited to as a member. `/api/orgs` returns the real role
// ('owner' even for a superadmin's own orgs; 'manager'|'editor'|'viewer' for
// collaborations), so the grouping is authoritative.
const owned = computed(() =>
  (data.value?.orgs ?? []).filter((o) => o.role === 'owner' || o.role === 'superadmin'),
)
const collaborated = computed(() =>
  (data.value?.orgs ?? []).filter((o) => !['owner', 'superadmin'].includes(o.role)),
)
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold tracking-tight sm:text-2xl">Your organizations</h1>
        <p class="mt-1 text-sm text-muted-foreground">
          Each org has its own verify gateway at <code>/&lt;slug&gt;</code>.
        </p>
      </div>
      <Button @click="navigateTo('/dashboard/new')">New organization</Button>
    </div>

    <div v-if="pending" class="mt-10 text-muted-foreground">Loading…</div>

    <div
      v-else-if="!data?.orgs?.length"
      class="mt-10 rounded-lg border border-dashed p-12 text-center"
    >
      <p class="text-muted-foreground">No organizations yet.</p>
      <Button class="mt-4" @click="navigateTo('/dashboard/new')">Create your first org</Button>
    </div>

    <div v-else class="mt-6 space-y-10">
      <!-- Orgs the viewer owns -->
      <section v-if="owned.length">
        <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Owner <span class="font-normal text-muted-foreground/60">· {{ owned.length }}</span>
        </h2>
        <ul class="space-y-2">
          <li
            v-for="org in owned"
            :key="org.id"
            class="flex items-center justify-between gap-3 rounded-lg border p-4"
          >
            <NuxtLink :to="`/dashboard/${org.slug}`" class="truncate font-medium underline">{{
              org.name
            }}</NuxtLink>
            <div class="flex shrink-0 items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                @click="navigateTo(`/dashboard/${org.slug}/share`)"
                >Share</Button
              >
              <a
                :href="`/${org.slug}`"
                target="_blank"
                :class="buttonVariants({ variant: 'ghost', size: 'sm' })"
                >View ↗</a
              >
            </div>
          </li>
        </ul>
      </section>

      <!-- Orgs the viewer was invited to as a member -->
      <section v-if="collaborated.length">
        <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Collaborator
          <span class="font-normal text-muted-foreground/60">· {{ collaborated.length }}</span>
        </h2>
        <ul class="space-y-2">
          <li
            v-for="org in collaborated"
            :key="org.id"
            class="flex items-center justify-between gap-3 rounded-lg border p-4"
          >
            <div class="flex min-w-0 items-center gap-2">
              <NuxtLink :to="`/dashboard/${org.slug}`" class="truncate font-medium underline">{{
                org.name
              }}</NuxtLink>
              <span class="text-xs capitalize text-muted-foreground/70">{{ org.role }}</span>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                @click="navigateTo(`/dashboard/${org.slug}/share`)"
                >Share</Button
              >
              <a
                :href="`/${org.slug}`"
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
