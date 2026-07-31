<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: ['auth', 'superadmin'] })

interface UserRow {
  id: number
  email: string
  role: string
  createdAt: string
}

const { user: currentUser } = useAuth()
const { data: users, refresh: refreshUsers } = await useFetch<UserRow[]>('/api/admin/users')
const saving = ref<Record<number, boolean>>({})
const deleting = ref<Record<number, boolean>>({})

function isSelf(user: UserRow) {
  return user.id === currentUser.value?.id
}

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

async function onDelete(user: UserRow) {
  if (isSelf(user)) return
  if (
    !confirm(
      `Permanently delete user "${user.email}"? Any organizations they own will be transferred to you. This cannot be undone.`,
    )
  )
    return
  deleting.value[user.id] = true
  try {
    const res = await $fetch<{ reassignedOrgs: number }>(`/api/admin/users/${user.id}`, {
      method: 'DELETE',
    })
    toast.success(
      res.reassignedOrgs > 0
        ? `User deleted (${res.reassignedOrgs} organization${res.reassignedOrgs > 1 ? 's' : ''} transferred to you)`
        : 'User deleted',
    )
    await refreshUsers()
  } catch (e) {
    toast.error(messageFromError(e, 'Delete failed'))
  } finally {
    deleting.value[user.id] = false
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
                <th class="py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="u in users" :key="u.id" class="border-b last:border-0">
                <td class="py-3 text-muted-foreground">{{ u.id }}</td>
                <td class="py-3 font-medium">
                  {{ u.email }}
                  <span v-if="isSelf(u)" class="ml-1 text-xs font-normal text-muted-foreground"
                    >(you)</span
                  >
                </td>
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
                <td class="py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    class="text-destructive hover:text-destructive"
                    :disabled="isSelf(u) || deleting[u.id]"
                    :title="isSelf(u) ? 'You cannot delete your own account' : ''"
                    @click="onDelete(u)"
                  >
                    {{ deleting[u.id] ? '…' : 'Delete' }}
                  </Button>
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
                <div class="truncate font-medium">
                  {{ u.email }}
                  <span v-if="isSelf(u)" class="text-xs font-normal text-muted-foreground"
                    >(you)</span
                  >
                </div>
                <div class="text-xs text-muted-foreground">ID {{ u.id }}</div>
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <select
                  :value="u.role"
                  :disabled="saving[u.id]"
                  class="h-9 rounded-md border bg-transparent px-2 text-xs"
                  @change="onRoleChange(u, ($event.target as HTMLSelectElement).value)"
                >
                  <option value="admin">admin</option>
                  <option value="superadmin">superadmin</option>
                </select>
                <Button
                  variant="ghost"
                  size="sm"
                  class="text-destructive hover:text-destructive"
                  :disabled="isSelf(u) || deleting[u.id]"
                  @click="onDelete(u)"
                >
                  {{ deleting[u.id] ? '…' : 'Delete' }}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>
