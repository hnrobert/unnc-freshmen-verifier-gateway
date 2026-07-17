<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: ['auth', 'superadmin'] })

interface UserRow { id: number; email: string; role: string; createdAt: string }
interface OrgRow { id: number; slug: string; name: string; createdAt: string; ownerEmail: string }

const route = useRoute()
const tab = computed({
  get: () => (route.query.tab === 'users' ? 'users' : 'orgs') as 'users' | 'orgs',
  set: (v) => navigateTo({ path: '/dashboard/admin', query: { tab: v } }),
})

const { data: users, refresh: refreshUsers } = await useFetch<UserRow[]>('/api/admin/users')
const { data: orgs } = await useFetch<OrgRow[]>('/api/admin/orgs')
const saving = ref<Record<number, boolean>>({})

async function onRoleChange(user: UserRow, role: string) {
  saving.value[user.id] = true
  try {
    await $fetch(`/api/admin/users/${user.id}`, { method: 'PATCH', body: { role } })
    user.role = role
  } catch (e) {
    alert(messageFromError(e, 'Update failed'))
    await refreshUsers()
  } finally {
    saving.value[user.id] = false
  }
}
</script>

<template>
  <div>
    <h1 class="text-xl font-semibold tracking-tight sm:text-2xl">
      {{ tab === 'users' ? 'Users' : 'All Organizations' }}
    </h1>

    <!-- Orgs tab -->
    <div v-if="tab === 'orgs'" class="mt-6 space-y-3">
      <Card v-for="org in orgs" :key="org.id">
        <CardContent>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="min-w-0">
              <div class="font-medium">{{ org.name }}</div>
              <div class="text-xs text-muted-foreground">/{{ org.slug }} · {{ org.ownerEmail }}</div>
            </div>
            <div class="flex gap-2">
              <Button size="sm" variant="outline" @click="navigateTo(`/dashboard/${org.slug}/edit`)">Edit</Button>
              <a :href="`/${org.slug}/preview`" target="_blank" class="inline-flex h-8 items-center rounded-md px-3 text-xs font-medium border hover:bg-accent">Preview ↗</a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Users tab -->
    <div v-else class="mt-6">
      <Card class="hidden sm:block">
        <CardContent>
          <table class="w-full text-sm">
            <thead><tr class="border-b text-left text-muted-foreground">
              <th class="py-3 font-medium">ID</th><th class="py-3 font-medium">Email</th>
              <th class="py-3 font-medium">Role</th><th class="py-3 font-medium">Created</th>
            </tr></thead>
            <tbody>
              <tr v-for="u in users" :key="u.id" class="border-b last:border-0">
                <td class="py-3 text-muted-foreground">{{ u.id }}</td>
                <td class="py-3 font-medium">{{ u.email }}</td>
                <td class="py-3">
                  <select :value="u.role" :disabled="saving[u.id]" class="rounded-md border bg-transparent px-2 py-1 text-sm"
                    @change="onRoleChange(u, ($event.target as HTMLSelectElement).value)">
                    <option value="admin">admin</option><option value="superadmin">superadmin</option>
                  </select>
                </td>
                <td class="py-3 text-muted-foreground">{{ new Date(u.createdAt).toLocaleDateString() }}</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
      <div class="space-y-3 sm:hidden">
        <Card v-for="u in users" :key="u.id">
          <CardContent>
            <div class="flex items-center justify-between gap-2">
              <div class="min-w-0">
                <div class="truncate font-medium">{{ u.email }}</div>
                <div class="text-xs text-muted-foreground">ID {{ u.id }}</div>
              </div>
              <select :value="u.role" :disabled="saving[u.id]" class="shrink-0 rounded-md border bg-transparent px-2 py-1 text-xs"
                @change="onRoleChange(u, ($event.target as HTMLSelectElement).value)">
                <option value="admin">admin</option><option value="superadmin">superadmin</option>
              </select>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>
