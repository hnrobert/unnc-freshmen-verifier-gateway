<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: ['auth', 'superadmin'] })

interface OrgRow {
  id: number
  slug: string
  name: string
  createdAt: string
  ownerEmail: string
}

const { data: orgs } = await useFetch<OrgRow[]>('/api/admin/orgs')
</script>

<template>
  <div>
    <h1 class="text-xl font-semibold tracking-tight sm:text-2xl">All Organizations</h1>
    <div class="mt-6 space-y-3">
      <Card v-for="org in orgs" :key="org.id">
        <CardContent>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="min-w-0">
              <div class="font-medium">{{ org.name }}</div>
              <div class="text-xs text-muted-foreground">
                /{{ org.slug }} · {{ org.ownerEmail }}
              </div>
            </div>
            <div class="flex gap-2">
              <Button size="sm" variant="outline" @click="navigateTo(`/dashboard/${org.slug}/edit`)"
                >Edit</Button
              >
              <a
                :href="`/${org.slug}/preview`"
                target="_blank"
                class="inline-flex h-9 items-center rounded-md px-3 text-xs font-medium border hover:bg-accent"
                >Preview ↗</a
              >
              <OrgLinkActions variant="outline" :slug="org.slug" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
