<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: ['auth', 'superadmin'] })

interface AuditRow {
  id: number
  createdAt: string
  orgId: number | null
  orgName: string | null
  action: string
  outcome: string | null
  actorType: string | null
  userId: number | null
  email: string | null
  name: string | null
  detail: Record<string, unknown> | null
}

interface AuditResponse {
  events: AuditRow[]
  total: number
  retentionDays: number
}

interface OrgRow {
  id: number
  name: string
  slug: string
}

// Curated action + outcome lists (the API accepts any string, these just seed
// the dropdowns with everything the instrumentation emits).
const ACTIONS = [
  'verify',
  'send_code',
  'login',
  'register',
  'email_change',
  'password_change',
  'passkey_add',
  'passkey_remove',
  'org.create',
  'org.rename',
  'org.delete',
  'org.transfer',
  'member.add',
  'member.role',
  'member.remove',
  'admin.user_update',
  'admin.user_delete',
  'admin.default_limit',
]
const OUTCOMES = ['success', 'failure', 'admitted', 'denied', 'error']

// --- Filters ---
const action = ref<string>('')
const outcome = ref<string>('')
const orgId = ref<string>('')
const from = ref<string>('')
const to = ref<string>('')
const limit = ref<number>(50)
const offset = ref<number>(0)

// Debounced free-text search (name/email). Typing doesn't refetch per keystroke.
const searchInput = ref<string>('')
const search = ref<string>('')
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(searchInput, (v) => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    search.value = v.trim()
    offset.value = 0
  }, 300)
})

// Reset to the first page whenever any filter narrows the result set.
watch([action, outcome, orgId, from, to, limit], () => {
  offset.value = 0
})

const query = computed(() => {
  const q: Record<string, string | number> = {
    limit: limit.value,
    offset: offset.value,
  }
  if (action.value) q.action = action.value
  if (outcome.value) q.outcome = outcome.value
  if (orgId.value) q.orgId = orgId.value
  if (search.value) q.search = search.value
  if (from.value) q.from = `${from.value}T00:00:00`
  // Inclusive end-of-day so a `to` date captures events later that day.
  if (to.value) q.to = `${to.value}T23:59:59`
  return q
})

const { data, pending, refresh } = await useFetch<AuditResponse>('/api/admin/audit', {
  query,
})

const { data: orgs } = await useFetch<OrgRow[]>('/api/admin/orgs')

// --- Retention config ---
const retentionDraft = ref<string>(data.value ? String(data.value.retentionDays) : '90')
const savingRetention = ref(false)
const retentionDirty = computed(
  () => retentionDraft.value !== String(data.value?.retentionDays ?? 90),
)

async function onSaveRetention() {
  const n = Number(retentionDraft.value)
  if (!Number.isInteger(n) || n < 1) {
    toast.error('Retention must be a positive integer (days)')
    return
  }
  savingRetention.value = true
  try {
    const res = await $fetch<{ retentionDays: number }>('/api/admin/audit/retention', {
      method: 'PUT',
      body: { retentionDays: n },
    })
    if (data.value) data.value.retentionDays = res.retentionDays
    retentionDraft.value = String(res.retentionDays)
    toast.success(`Audit retention set to ${res.retentionDays} days`)
  } catch (e) {
    toast.error(messageFromError(e, 'Update failed'))
  } finally {
    savingRetention.value = false
  }
}

function resetFilters() {
  action.value = ''
  outcome.value = ''
  orgId.value = ''
  searchInput.value = ''
  search.value = ''
  from.value = ''
  to.value = ''
  offset.value = 0
}

// --- Pagination ---
const totalPages = computed(() => Math.max(1, Math.ceil((data.value?.total ?? 0) / limit.value)))
const page = computed(() => Math.floor(offset.value / limit.value) + 1)
const rangeStart = computed(() => (data.value?.events.length ? offset.value + 1 : 0))
const rangeEnd = computed(() => offset.value + (data.value?.events.length ?? 0))
function prevPage() {
  offset.value = Math.max(0, offset.value - limit.value)
}
function nextPage() {
  if (offset.value + limit.value < (data.value?.total ?? 0)) offset.value += limit.value
}

function outcomeClass(o: string | null): string {
  if (!o) return 'bg-muted text-muted-foreground'
  if (o === 'success' || o === 'admitted')
    return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
  if (o === 'failure' || o === 'denied' || o === 'error')
    return 'bg-destructive/15 text-destructive'
  return 'bg-muted text-muted-foreground'
}

function detailText(d: Record<string, unknown> | null): string {
  return d ? JSON.stringify(d) : ''
}

function timeLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold tracking-tight sm:text-2xl">Audit Log</h1>
        <p class="mt-1 text-sm text-muted-foreground">
          Every recorded site action — who, when, and whether it succeeded. Entries older than the
          retention window are pruned automatically.
        </p>
      </div>
      <Button variant="outline" size="sm" :disabled="pending" @click="() => refresh()">
        <Icon spec="RefreshCw" :size="14" :class="pending ? 'animate-spin' : ''" />
        <span class="ml-1.5">Refresh</span>
      </Button>
    </div>

    <!-- Retention config -->
    <Card class="mt-6">
      <CardContent>
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div class="text-sm font-medium">Retention period</div>
            <p class="mt-0.5 text-xs text-muted-foreground">
              Audit events are deleted after this many days (default 90). Lowering it prunes old
              entries on the next housekeeping pass.
            </p>
          </div>
          <div class="flex items-center gap-2">
            <input
              type="number"
              min="1"
              inputmode="numeric"
              class="h-9 w-24 rounded-md border bg-transparent px-2 text-sm"
              :value="retentionDraft"
              :disabled="savingRetention"
              @input="retentionDraft = ($event.target as HTMLInputElement).value"
              @keydown.enter.prevent="onSaveRetention"
            />
            <span class="text-xs text-muted-foreground">days</span>
            <Button
              size="sm"
              :disabled="savingRetention || !retentionDirty"
              @click="onSaveRetention"
            >
              {{ savingRetention ? '…' : 'Save' }}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Filters -->
    <Card class="mt-6">
      <CardContent>
        <div class="flex flex-wrap items-end gap-3">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-muted-foreground">Action</label>
            <select v-model="action" class="h-9 rounded-md border bg-transparent px-2 text-sm">
              <option value="">All actions</option>
              <option v-for="a in ACTIONS" :key="a" :value="a">{{ a }}</option>
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-muted-foreground">Outcome</label>
            <select v-model="outcome" class="h-9 rounded-md border bg-transparent px-2 text-sm">
              <option value="">Any</option>
              <option v-for="o in OUTCOMES" :key="o" :value="o">{{ o }}</option>
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-muted-foreground">Organization</label>
            <select
              v-model="orgId"
              class="h-9 max-w-48 rounded-md border bg-transparent px-2 text-sm"
            >
              <option value="">All orgs</option>
              <option v-for="o in orgs ?? []" :key="o.id" :value="String(o.id)">
                {{ o.name }}
              </option>
            </select>
          </div>
          <div class="flex flex-1 flex-col gap-1" style="min-width: 12rem">
            <label class="text-xs font-medium text-muted-foreground">Search name / email</label>
            <div class="relative">
              <Icon
                spec="Search"
                :size="14"
                class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                v-model="searchInput"
                type="text"
                placeholder="Name or email"
                class="h-9 w-full rounded-md border bg-transparent pl-8 pr-2 text-sm"
              />
            </div>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-muted-foreground">From</label>
            <input
              v-model="from"
              type="date"
              class="h-9 rounded-md border bg-transparent px-2 text-sm"
            />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-muted-foreground">To</label>
            <input
              v-model="to"
              type="date"
              class="h-9 rounded-md border bg-transparent px-2 text-sm"
            />
          </div>
          <Button variant="ghost" size="sm" @click="resetFilters">Reset</Button>
        </div>
      </CardContent>
    </Card>

    <!-- Result summary -->
    <div class="mt-6 flex items-center justify-between gap-4">
      <p class="text-sm text-muted-foreground">
        <template v-if="data && data.total > 0">
          Showing
          <span class="font-medium text-foreground">{{ rangeStart }}–{{ rangeEnd }}</span> of
          <span class="font-medium text-foreground">{{ data.total }}</span> events
        </template>
        <template v-else>No events match these filters.</template>
      </p>
    </div>

    <!-- Desktop table -->
    <Card class="mt-3 hidden sm:block">
      <CardContent>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b text-left text-muted-foreground">
                <th class="py-3 pr-4 font-medium">Time</th>
                <th class="py-3 pr-4 font-medium">Action</th>
                <th class="py-3 pr-4 font-medium">Outcome</th>
                <th class="py-3 pr-4 font-medium">Person</th>
                <th class="py-3 pr-4 font-medium">Organization</th>
                <th class="py-3 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in data?.events ?? []" :key="row.id" class="border-b last:border-0">
                <td class="py-3 pr-4 align-top whitespace-nowrap text-muted-foreground">
                  {{ timeLabel(row.createdAt) }}
                </td>
                <td class="py-3 pr-4 align-top font-medium">{{ row.action }}</td>
                <td class="py-3 pr-4 align-top">
                  <span
                    v-if="row.outcome"
                    class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                    :class="outcomeClass(row.outcome)"
                    >{{ row.outcome }}</span
                  >
                  <span v-else class="text-muted-foreground">—</span>
                </td>
                <td class="py-3 pr-4 align-top">
                  <div v-if="row.name">{{ row.name }}</div>
                  <div v-if="row.email" class="text-muted-foreground">{{ row.email }}</div>
                  <div v-if="!row.name && !row.email" class="text-xs italic text-muted-foreground">
                    {{ row.actorType ?? 'system' }}
                  </div>
                </td>
                <td class="py-3 pr-4 align-top text-muted-foreground">
                  {{ row.orgName ?? (row.orgId != null ? `#${row.orgId}` : '—') }}
                </td>
                <td class="py-3 align-top">
                  <code
                    v-if="row.detail"
                    class="block max-h-20 max-w-xs overflow-auto break-all rounded bg-muted px-1.5 py-1 text-xs"
                    >{{ detailText(row.detail) }}</code
                  >
                  <span v-else class="text-muted-foreground">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>

    <!-- Mobile cards -->
    <div class="mt-3 space-y-3 sm:hidden">
      <Card v-for="row in data?.events ?? []" :key="row.id">
        <CardContent>
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="font-medium">{{ row.action }}</div>
              <div class="mt-0.5 text-xs text-muted-foreground">{{ timeLabel(row.createdAt) }}</div>
            </div>
            <span
              v-if="row.outcome"
              class="inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
              :class="outcomeClass(row.outcome)"
              >{{ row.outcome }}</span
            >
          </div>
          <dl class="mt-3 space-y-1 text-xs">
            <div v-if="row.name || row.email" class="flex gap-2">
              <dt class="w-20 shrink-0 text-muted-foreground">Person</dt>
              <dd class="min-w-0 break-all">
                <span v-if="row.name">{{ row.name }}</span>
                <span v-if="row.name && row.email" class="text-muted-foreground"> · </span>
                <span v-if="row.email" class="text-muted-foreground">{{ row.email }}</span>
              </dd>
            </div>
            <div class="flex gap-2">
              <dt class="w-20 shrink-0 text-muted-foreground">Organization</dt>
              <dd>{{ row.orgName ?? (row.orgId != null ? `#${row.orgId}` : '—') }}</dd>
            </div>
            <div v-if="row.detail" class="flex gap-2">
              <dt class="w-20 shrink-0 text-muted-foreground">Detail</dt>
              <dd class="min-w-0">
                <code class="block max-h-24 overflow-auto break-all rounded bg-muted px-1.5 py-1">{{
                  detailText(row.detail)
                }}</code>
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>

    <!-- Pagination -->
    <div v-if="data && data.total > 0" class="mt-6 flex items-center justify-between gap-4">
      <Button variant="outline" size="sm" :disabled="offset === 0" @click="prevPage">
        <Icon spec="ArrowLeft" :size="14" />
        <span class="ml-1.5">Prev</span>
      </Button>
      <span class="text-sm text-muted-foreground">Page {{ page }} of {{ totalPages }}</span>
      <Button
        variant="outline"
        size="sm"
        :disabled="offset + limit >= data.total"
        @click="nextPage"
      >
        <span class="mr-1.5">Next</span>
        <Icon spec="ArrowRight" :size="14" />
      </Button>
    </div>
  </div>
</template>
