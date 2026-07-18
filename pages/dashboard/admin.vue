<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: ['auth', 'superadmin'] })

interface UserRow {
  id: number
  email: string
  role: string
  createdAt: string
}
interface OrgRow {
  id: number
  slug: string
  name: string
  createdAt: string
  ownerEmail: string
}

const route = useRoute()
type AdminTab = 'orgs' | 'users' | 'registration'
const tab = computed({
  get: () =>
    (route.query.tab === 'users' || route.query.tab === 'registration'
      ? route.query.tab
      : 'orgs') as AdminTab,
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
    toast.success('Role updated')
  } catch (e) {
    toast.error(messageFromError(e, 'Update failed'))
    await refreshUsers()
  } finally {
    saving.value[user.id] = false
  }
}

// Registration email whitelist (superadmin-only).
interface WhitelistConfig {
  enabled: boolean
  patterns: string[]
}
const { data: whitelist } = await useFetch<WhitelistConfig>('/api/admin/registration')
const wlEnabled = ref(false)
const wlPatternsText = ref('')
const wlSaving = ref(false)
const wlSaved = ref(false)
// Snapshot of the persisted values, for dirty tracking + discard.
const wlOriginal = ref({ enabled: false, patternsText: '' })
watch(
  whitelist,
  (w) => {
    if (!w) return
    const snap = { enabled: w.enabled, patternsText: w.patterns.join('\n') }
    wlEnabled.value = snap.enabled
    wlPatternsText.value = snap.patternsText
    wlOriginal.value = snap
  },
  { immediate: true },
)
const wlDirty = computed(
  () =>
    wlEnabled.value !== wlOriginal.value.enabled ||
    wlPatternsText.value !== wlOriginal.value.patternsText,
)
async function saveWhitelist() {
  wlSaving.value = true
  wlSaved.value = false
  try {
    const patterns = wlPatternsText.value
      .split('\n')
      .map((p) => p.trim())
      .filter(Boolean)
    const res = await $fetch<WhitelistConfig>('/api/admin/registration', {
      method: 'PUT',
      body: { enabled: wlEnabled.value, patterns },
    })
    const snap = { enabled: res.enabled, patternsText: res.patterns.join('\n') }
    wlEnabled.value = snap.enabled
    wlPatternsText.value = snap.patternsText
    wlOriginal.value = snap
    wlSaved.value = true
    setTimeout(() => (wlSaved.value = false), 2000)
  } catch (e) {
    toast.error(messageFromError(e, 'Save failed'))
  } finally {
    wlSaving.value = false
  }
}
function discardWhitelist() {
  wlEnabled.value = wlOriginal.value.enabled
  wlPatternsText.value = wlOriginal.value.patternsText
}
</script>

<template>
  <div>
    <h1 class="text-xl font-semibold tracking-tight sm:text-2xl">
      {{
        tab === 'users' ? 'Users' : tab === 'registration' ? 'Registration' : 'All Organizations'
      }}
    </h1>

    <!-- Orgs tab -->
    <div v-if="tab === 'orgs'" class="mt-6 space-y-3">
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
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Users tab -->
    <div v-else-if="tab === 'users'" class="mt-6">
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

    <!-- Registration email whitelist tab -->
    <div v-else-if="tab === 'registration'" class="mt-6 space-y-4 pb-24">
      <Card>
        <CardContent class="space-y-4">
          <div class="flex items-start gap-3">
            <input
              id="wl-enabled"
              v-model="wlEnabled"
              type="checkbox"
              class="mt-0.5 size-4 rounded border"
            />
            <div>
              <Label for="wl-enabled" class="cursor-pointer font-medium"
                >Restrict registration by email</Label
              >
              <p class="text-xs text-muted-foreground">
                When on, only emails matching a pattern below can register. Off = open registration
                (current default).
              </p>
            </div>
          </div>
          <div class="space-y-1.5">
            <Label for="wl-patterns">Allowed email patterns (glob, one per line)</Label>
            <textarea
              id="wl-patterns"
              v-model="wlPatternsText"
              rows="8"
              spellcheck="false"
              class="w-full rounded-md border bg-transparent p-3 font-mono text-sm"
              placeholder="*@nottingham.edu.cn&#10;*@*.nottingham.edu.cn&#10;{john,jane}@example.com"
            ></textarea>
            <p class="text-xs text-muted-foreground">
              Glob: <code>*</code> any chars, <code>?</code> one char,
              <code>{a,b}</code> alternation. Case-insensitive. The first registration (superadmin
              bootstrap) is always allowed.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Sticky save/discard bar (registration whitelist only) -->
    <SaveBar
      v-if="tab === 'registration'"
      :dirty="wlDirty"
      :saving="wlSaving"
      :saved="wlSaved"
      @save="saveWhitelist"
      @discard="discardWhitelist"
    />
  </div>
</template>
