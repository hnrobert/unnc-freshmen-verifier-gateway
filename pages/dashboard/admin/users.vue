<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: ['auth', 'superadmin'] })

interface UserRow {
  id: number
  email: string
  role: string
  createdAt: string
}

const { data: users, refresh: refreshUsers } = await useFetch<UserRow[]>('/api/admin/users')
const saving = ref<Record<number, boolean>>({})

async function onRoleChange(user: UserRow, role: string) {
  saving.value[user.id] = true
  try {
    await $fetch(`/api/admin/users/${user.id}`, { method: 'PATCH', body: { role } })
    user.role = role
    toast.success('Role updated')
  } catch (e) {
    toast.error(messageFromError(e, 'Update failed'))
    await refreshUsers()
  } finally {
    saving.value[user.id] = false
  }
}
</script>

<template>
  <div>
    <h1 class="text-xl font-semibold tracking-tight sm:text-2xl">Users</h1>
    <div class="mt-6">
      <Card class="hidden sm:block">
        <CardContent>
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b text-left text-muted-foreground">
                <th class="py-3 font-medium">ID</th>
                <th class="py-3 font-medium">Email</th>
                <th class="py-3 font-medium">Role</th>
                <th class="py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="u in users" :key="u.id" class="border-b last:border-0">
                <td class="py-3 text-muted-foreground">{{ u.id }}</td>
                <td class="py-3 font-medium">{{ u.email }}</td>
                <td class="py-3">
                  <select
                    :value="u.role"
                    :disabled="saving[u.id]"
                    class="h-9 rounded-md border bg-transparent px-2 text-sm"
                    @change="onRoleChange(u, ($event.target as HTMLSelectElement).value)"
                  >
                    <option value="admin">admin</option>
                    <option value="superadmin">superadmin</option>
                  </select>
                </td>
                <td class="py-3 text-muted-foreground">
                  {{ new Date(u.createdAt).toLocaleDateString() }}
                </td>
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
              <select
                :value="u.role"
                :disabled="saving[u.id]"
                class="h-9 shrink-0 rounded-md border bg-transparent px-2 text-xs"
                @change="onRoleChange(u, ($event.target as HTMLSelectElement).value)"
              >
                <option value="admin">admin</option>
                <option value="superadmin">superadmin</option>
              </select>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>
