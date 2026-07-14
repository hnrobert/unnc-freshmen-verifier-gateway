<script setup lang="ts">
import { buttonVariants } from '~/components/ui/button'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const { data, pending, refresh } = await useFetch('/api/orgs')
const deleting = ref('')

async function onDelete(slug: string) {
  if (!confirm(`Delete organization "${slug}"? This cannot be undone.`)) return
  deleting.value = slug
  try {
    await $fetch(`/api/orgs/${slug}`, { method: 'DELETE' })
    await refresh()
  } catch (e) {
    alert(messageFromError(e, 'Delete failed'))
  } finally {
    deleting.value = ''
  }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Your organizations</h1>
        <p class="mt-1 text-sm text-muted-foreground">Each org has its own verify gateway at <code>/&lt;slug&gt;</code>.</p>
      </div>
      <Button @click="navigateTo('/dashboard/new')">New organization</Button>
    </div>

    <div v-if="pending" class="mt-10 text-muted-foreground">Loading…</div>

    <div v-else-if="!data?.orgs?.length" class="mt-10 rounded-lg border border-dashed p-12 text-center">
      <p class="text-muted-foreground">No organizations yet.</p>
      <Button class="mt-4" @click="navigateTo('/dashboard/new')">Create your first org</Button>
    </div>

    <ul v-else class="mt-6 grid gap-3 sm:grid-cols-2">
      <li v-for="org in data.orgs" :key="org.id" class="rounded-lg border p-4">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="font-medium">{{ org.name }}</div>
            <div class="text-sm text-muted-foreground">/{{ org.slug }}</div>
          </div>
          <Button variant="outline" size="sm" :disabled="deleting === org.slug" @click="onDelete(org.slug)">
            {{ deleting === org.slug ? '…' : 'Delete' }}
          </Button>
        </div>
        <div class="mt-3 flex gap-2">
          <Button variant="outline" size="sm" @click="navigateTo(`/dashboard/${org.slug}/edit`)">Edit</Button>
          <a :href="`/${org.slug}`" target="_blank" :class="buttonVariants({ variant: 'ghost', size: 'sm' })">View ↗</a>
        </div>
      </li>
    </ul>
  </div>
</template>
