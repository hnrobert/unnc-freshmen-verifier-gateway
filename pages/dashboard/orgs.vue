<script setup lang="ts">
import { buttonVariants } from '~/components/ui/button'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const { data, pending } = await useFetch('/api/orgs')
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

    <ul v-else class="mt-6 space-y-2">
      <li
        v-for="org in data.orgs"
        :key="org.id"
        class="flex items-center justify-between gap-3 rounded-lg border p-4"
      >
        <NuxtLink
          :to="`/dashboard/${org.slug}`"
          class="min-w-0 truncate font-medium hover:underline"
          >{{ org.name }}</NuxtLink
        >
        <div class="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" @click="navigateTo(`/dashboard/${org.slug}/share`)"
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
  </div>
</template>
