<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: ['auth', 'superadmin'] })

interface UserRow {
  id: number
  email: string
  role: string
  createdAt: string
}

const { data, refresh } = await useFetch<UserRow[]>('/api/admin/users')
const saving = ref<Record<number, boolean>>({})

async function onRoleChange(user: UserRow, role: string) {
  saving.value[user.id] = true
  try {
    await $fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      body: { role },
    })
    user.role = role
  } catch (e) {
    alert(messageFromError(e, 'Update failed'))
    await refresh()
  } finally {
    saving.value[user.id] = false
  }
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-semibold tracking-tight">User management</h1>
    <p class="mt-1 text-sm text-muted-foreground">Manage user roles across the platform.</p>

    <Card class="mt-6">
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
            <tr v-for="u in data" :key="u.id" class="border-b last:border-0">
              <td class="py-3 text-muted-foreground">{{ u.id }}</td>
              <td class="py-3 font-medium">{{ u.email }}</td>
              <td class="py-3">
                <select
                  :value="u.role"
                  :disabled="saving[u.id]"
                  class="rounded-md border bg-transparent px-2 py-1 text-sm"
                  @change="onRoleChange(u, ($event.target as HTMLSelectElement).value)"
                >
                  <option value="admin">admin</option>
                  <option value="superadmin">superadmin</option>
                </select>
              </td>
              <td class="py-3 text-muted-foreground">{{ new Date(u.createdAt).toLocaleDateString() }}</td>
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>
  </div>
</template>
