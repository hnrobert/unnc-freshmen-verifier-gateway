<script setup lang="ts">
import { DEFAULT_ADMIN_PAGE_LIMIT } from '#shared/types'

definePageMeta({ layout: 'dashboard', middleware: ['auth', 'superadmin'] })

interface UserRow {
  id: number
  email: string
  role: string
  pageLimit: number | null
  pageCount: number
  createdAt: string
}

const { user: currentUser } = useAuth()
const { data: users, refresh: refreshUsers } = await useFetch<UserRow[]>('/api/admin/users')
const saving = ref<Record<number, boolean>>({})
const deleting = ref<Record<number, boolean>>({})
// Per-user text draft for the page-limit input. '' (empty) = use the default.
const limitDraft = ref<Record<number, string>>({})

// App-wide default page limit (superadmin-tunable). Falls back to the constant
// before the first load resolves.
const { data: limitsData, refresh: refreshLimits } = await useFetch<{
  defaultAdminPageLimit: number
}>('/api/admin/limits')
const defaultLimit = computed(
  () => limitsData.value?.defaultAdminPageLimit ?? DEFAULT_ADMIN_PAGE_LIMIT,
)
const defaultDraft = ref(limitsData.value ? String(defaultLimit.value) : '')
const savingDefault = ref(false)

// Backfill drafts for newly-loaded users without clobbering in-flight edits.
watchEffect(() => {
  for (const u of users.value ?? []) {
    if (!(u.id in limitDraft.value)) {
      limitDraft.value[u.id] = u.pageLimit == null ? '' : String(u.pageLimit)
    }
  }
})

function isSelf(user: UserRow) {
  return user.id === currentUser.value?.id
}

function limitDirty(user: UserRow): boolean {
  const cur = user.pageLimit == null ? '' : String(user.pageLimit)
  return (limitDraft.value[user.id] ?? '') !== cur
}

async function onRoleChange(user: UserRow, role: string) {
  saving.value[user.id] = true
  try {
    const res = await $fetch<{ role: string }>(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      body: { role },
    })
    user.role = res.role
    toast.success('Role updated')
  } catch (e) {
    toast.error(messageFromError(e, 'Update failed'))
    await refreshUsers()
  } finally {
    saving.value[user.id] = false
  }
}

async function onSaveLimit(user: UserRow) {
  const raw = (limitDraft.value[user.id] ?? '').trim()
  let body: { pageLimit: number | null }
  if (raw === '') {
    body = { pageLimit: null }
  } else {
    const n = Number(raw)
    if (!Number.isInteger(n) || n < 0) {
      toast.error('Limit must be a non-negative integer')
      return
    }
    body = { pageLimit: n }
  }
  saving.value[user.id] = true
  try {
    const res = await $fetch<{ pageLimit: number | null }>(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      body,
    })
    user.pageLimit = res.pageLimit
    limitDraft.value[user.id] = res.pageLimit == null ? '' : String(res.pageLimit)
    toast.success('Page limit updated')
  } catch (e) {
    toast.error(messageFromError(e, 'Update failed'))
    await refreshUsers()
  } finally {
    saving.value[user.id] = false
  }
}

function defaultDirty() {
  return defaultDraft.value !== String(defaultLimit.value)
}

async function onSaveDefault() {
  const n = Number(defaultDraft.value)
  if (!Number.isInteger(n) || n < 0) {
    toast.error('Limit must be a non-negative integer')
    return
  }
  savingDefault.value = true
  try {
    const res = await $fetch<{ defaultAdminPageLimit: number }>('/api/admin/limits', {
      method: 'PUT',
      body: { defaultAdminPageLimit: n },
    })
    limitsData.value = { defaultAdminPageLimit: res.defaultAdminPageLimit }
    defaultDraft.value = String(res.defaultAdminPageLimit)
    toast.success('Default page limit updated')
  } catch (e) {
    toast.error(messageFromError(e, 'Update failed'))
    await refreshLimits()
  } finally {
    savingDefault.value = false
  }
}

async function onDelete(user: UserRow) {
  if (isSelf(user)) return
  if (
    !confirm(
      `Permanently delete user "${user.email}"? Any pages they own will be transferred to you. This cannot be undone.`,
    )
  )
    return
  deleting.value[user.id] = true
  try {
    const res = await $fetch<{ reassignedPages: number }>(`/api/admin/users/${user.id}`, {
      method: 'DELETE',
    })
    toast.success(
      res.reassignedPages > 0
        ? `User deleted (${res.reassignedPages} page${res.reassignedPages > 1 ? 's' : ''} transferred to you)`
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
    <Card class="mt-6">
      <CardContent>
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div class="text-sm font-medium">Default page limit</div>
            <p class="mt-0.5 text-xs text-muted-foreground">
              Applied to admins without a per-user override. Superadmins are always unlimited.
            </p>
          </div>
          <div class="flex items-center gap-2">
            <input
              type="number"
              min="0"
              inputmode="numeric"
              class="h-9 w-24 rounded-md border bg-transparent px-2 text-sm"
              :value="defaultDraft"
              :disabled="savingDefault"
              @input="defaultDraft = ($event.target as HTMLInputElement).value"
              @keydown.enter.prevent="onSaveDefault"
            />
            <Button size="sm" :disabled="savingDefault || !defaultDirty()" @click="onSaveDefault">
              {{ savingDefault ? '…' : 'Save' }}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
    <div class="mt-6">
      <Card class="hidden sm:block">
        <CardContent>
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b text-left text-muted-foreground">
                <th class="py-3 font-medium">ID</th>
                <th class="py-3 font-medium">Email</th>
                <th class="py-3 font-medium">Role</th>
                <th class="py-3 font-medium">Page limit</th>
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
                <td class="py-3">
                  <span v-if="u.role === 'superadmin'" class="text-muted-foreground"
                    >Unlimited</span
                  >
                  <div v-else class="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      inputmode="numeric"
                      class="h-9 w-20 rounded-md border bg-transparent px-2 text-sm"
                      :placeholder="`Default (${defaultLimit})`"
                      :value="limitDraft[u.id] ?? ''"
                      :disabled="saving[u.id]"
                      @input="limitDraft[u.id] = ($event.target as HTMLInputElement).value"
                      @keydown.enter.prevent="onSaveLimit(u)"
                    />
                    <span class="whitespace-nowrap text-xs text-muted-foreground"
                      >{{ u.pageCount }} used</span
                    >
                    <Button
                      variant="ghost"
                      size="sm"
                      :disabled="saving[u.id] || !limitDirty(u)"
                      @click="onSaveLimit(u)"
                    >
                      {{ saving[u.id] ? '…' : 'Save' }}
                    </Button>
                  </div>
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
            <div
              v-if="u.role !== 'superadmin'"
              class="mt-3 flex flex-wrap items-center gap-2 border-t pt-3"
            >
              <span class="text-xs text-muted-foreground">Page limit</span>
              <input
                type="number"
                min="0"
                inputmode="numeric"
                class="h-9 w-20 rounded-md border bg-transparent px-2 text-sm"
                :placeholder="`Default (${DEFAULT_ADMIN_PAGE_LIMIT})`"
                :value="limitDraft[u.id] ?? ''"
                :disabled="saving[u.id]"
                @input="limitDraft[u.id] = ($event.target as HTMLInputElement).value"
                @keydown.enter.prevent="onSaveLimit(u)"
              />
              <span class="whitespace-nowrap text-xs text-muted-foreground"
                >{{ u.pageCount }} used</span
              >
              <Button
                variant="ghost"
                size="sm"
                :disabled="saving[u.id] || !limitDirty(u)"
                @click="onSaveLimit(u)"
              >
                {{ saving[u.id] ? '…' : 'Save' }}
              </Button>
            </div>
            <div v-else class="mt-3 border-t pt-3 text-xs text-muted-foreground">
              Unlimited pages
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>
