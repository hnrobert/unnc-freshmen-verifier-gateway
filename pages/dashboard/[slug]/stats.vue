<script setup lang="ts">
import { Line, Bar, Doughnut } from 'vue-chartjs'
import type { ChartOptions } from 'chart.js'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const slug = computed(() => route.params.slug as string)

const RANGES = ['7', '30', '90', 'all'] as const
const range = computed(() =>
  (RANGES as readonly string[]).includes(String(route.query.range))
    ? String(route.query.range)
    : '30',
)

interface StatsResult {
  range: number
  totals: {
    views: number
    uniqueVisitors: number
    verifyTotal: number
    admitted: number
    notFound: number
    error: number
    missing: number
    successRate: number | null
  }
  daily: {
    days: string[]
    views: number[]
    uniqueVisitors: (number | null)[]
    verifyTotal: number[]
    admitted: number[]
    notFound: number[]
    error: number[]
  }
  breakdowns: Record<string, { key: string; count: number }[]>
}
const {
  data: stats,
  pending,
  error,
} = await useFetch<StatsResult>(() => `/api/orgs/${slug.value}/stats?range=${range.value}`, {
  watch: [slug, range],
})

function setRange(r: string) {
  router.push({ query: { ...route.query, range: r } })
}

const C = {
  primary: '#F7D447',
  blue: '#3b82f6',
  green: '#22c55e',
  red: '#ef4444',
  purple: '#a855f7',
  gray: '#94a3b8',
}
const PALETTE = [C.primary, C.blue, C.green, C.red, C.purple, C.gray, '#f97316', '#14b8a6']

const lineData = computed(() => ({
  labels: stats.value?.daily.days ?? [],
  datasets: [
    {
      label: 'Page views',
      data: stats.value?.daily.views ?? [],
      borderColor: C.primary,
      backgroundColor: 'rgba(247,212,71,0.15)',
      fill: true,
      tension: 0.3,
      pointRadius: 2,
    },
    {
      label: 'Unique visitors',
      data: (stats.value?.daily.uniqueVisitors ?? []).map((v) => v ?? 0),
      borderColor: C.blue,
      tension: 0.3,
      pointRadius: 2,
    },
  ],
}))
const lineOpts: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#888' } } },
  scales: {
    x: { ticks: { color: '#888' }, grid: { color: 'rgba(120,120,120,0.15)' } },
    y: { ticks: { color: '#888' }, grid: { color: 'rgba(120,120,120,0.15)' }, beginAtZero: true },
  },
}

const barData = computed(() => ({
  labels: stats.value?.daily.days ?? [],
  datasets: [
    { label: 'Admitted', data: stats.value?.daily.admitted ?? [], backgroundColor: C.green },
    { label: 'Not found', data: stats.value?.daily.notFound ?? [], backgroundColor: C.red },
    { label: 'Error', data: stats.value?.daily.error ?? [], backgroundColor: C.purple },
  ],
}))
const barOpts: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#888' } } },
  scales: {
    x: { stacked: true, ticks: { color: '#888' }, grid: { color: 'rgba(120,120,120,0.15)' } },
    y: {
      stacked: true,
      ticks: { color: '#888' },
      grid: { color: 'rgba(120,120,120,0.15)' },
      beginAtZero: true,
    },
  },
}

const PRETTY: Record<string, string> = {
  admitted: 'Admitted',
  not_found: 'Not found',
  error: 'Error',
  missing: 'Missing input',
  mock: 'Mock',
  trusted: 'Trusted',
  live: 'Live',
}
const outcomeData = computed(() => ({
  labels: (stats.value?.breakdowns.outcome ?? []).map((b) => PRETTY[b.key] ?? b.key),
  datasets: [
    { data: (stats.value?.breakdowns.outcome ?? []).map((b) => b.count), backgroundColor: PALETTE },
  ],
}))
const modeData = computed(() => ({
  labels: (stats.value?.breakdowns.mode ?? []).map((b) => PRETTY[b.key] ?? b.key),
  datasets: [
    {
      data: (stats.value?.breakdowns.mode ?? []).map((b) => b.count),
      backgroundColor: [C.green, C.primary, C.blue],
    },
  ],
}))
const doughnutOpts: ChartOptions<'doughnut'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'right', labels: { color: '#888' } } },
}

function horizData(list: { key: string; count: number }[]) {
  return {
    labels: list.map((b) => b.key),
    datasets: [{ label: 'count', data: list.map((b) => b.count), backgroundColor: C.blue }],
  }
}
const horizOpts: ChartOptions<'bar'> = {
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { color: '#888' }, grid: { color: 'rgba(120,120,120,0.15)' }, beginAtZero: true },
    y: { ticks: { color: '#888' }, grid: { display: false } },
  },
}

const pct = (v: number | null) => (v === null ? '—' : `${(v * 100).toFixed(1)}%`)
</script>

<template>
  <div class="max-w-5xl space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold tracking-tight sm:text-2xl">
          Statistics · <code>/{{ slug }}</code>
        </h1>
        <p class="mt-1 text-sm text-muted-foreground">
          Page views, verifications, and visitor profile.
        </p>
      </div>
      <div class="flex gap-1 rounded-md border p-1">
        <button
          v-for="r in RANGES"
          :key="r"
          class="rounded px-2.5 py-1 text-sm"
          :class="
            range === r
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent'
          "
          @click="setRange(r)"
        >
          {{ r === 'all' ? 'All' : `${r}d` }}
        </button>
      </div>
    </div>

    <div v-if="pending" class="text-muted-foreground">Loading…</div>
    <StatusAlert
      v-else-if="error"
      variant="error"
      message="You don't have access to these statistics."
    />

    <template v-else-if="stats">
      <!-- KPIs -->
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card
          ><CardContent class="p-4"
            ><div class="text-xs text-muted-foreground">Views</div>
            <div class="text-2xl font-semibold">{{ stats.totals.views }}</div></CardContent
          ></Card
        >
        <Card
          ><CardContent class="p-4"
            ><div class="text-xs text-muted-foreground">Unique visitors</div>
            <div class="text-2xl font-semibold">{{ stats.totals.uniqueVisitors }}</div></CardContent
          ></Card
        >
        <Card
          ><CardContent class="p-4"
            ><div class="text-xs text-muted-foreground">Verifications</div>
            <div class="text-2xl font-semibold">{{ stats.totals.verifyTotal }}</div></CardContent
          ></Card
        >
        <Card
          ><CardContent class="p-4"
            ><div class="text-xs text-muted-foreground">Admitted</div>
            <div class="text-2xl font-semibold text-emerald-600">
              {{ stats.totals.admitted }}
            </div></CardContent
          ></Card
        >
        <Card
          ><CardContent class="p-4"
            ><div class="text-xs text-muted-foreground">Not found</div>
            <div class="text-2xl font-semibold text-red-600">
              {{ stats.totals.notFound }}
            </div></CardContent
          ></Card
        >
        <Card
          ><CardContent class="p-4"
            ><div class="text-xs text-muted-foreground">Success rate</div>
            <div class="text-2xl font-semibold">
              {{ pct(stats.totals.successRate) }}
            </div></CardContent
          ></Card
        >
      </div>

      <p v-if="range === 'all'" class="text-xs text-muted-foreground">
        Totals are all-time (from the permanent rollup). Daily trends and unique-visitor counts are
        only available within a fixed range (raw events are kept 90 days).
      </p>

      <ClientOnly v-if="range !== 'all'">
        <Card>
          <CardHeader
            ><CardTitle class="text-base">Views &amp; unique visitors</CardTitle></CardHeader
          >
          <CardContent
            ><div class="h-64"><Line :data="lineData" :options="lineOpts" /></div
          ></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle class="text-base">Verifications by outcome</CardTitle></CardHeader>
          <CardContent
            ><div class="h-64"><Bar :data="barData" :options="barOpts" /></div
          ></CardContent>
        </Card>
        <template #fallback><div class="text-muted-foreground">Loading charts…</div></template>
      </ClientOnly>

      <ClientOnly>
        <div class="grid gap-3 sm:grid-cols-2">
          <Card>
            <CardHeader><CardTitle class="text-base">Outcomes</CardTitle></CardHeader>
            <CardContent
              ><div class="h-56"><Doughnut :data="outcomeData" :options="doughnutOpts" /></div
            ></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle class="text-base">Modes</CardTitle></CardHeader>
            <CardContent
              ><div class="h-56"><Doughnut :data="modeData" :options="doughnutOpts" /></div
            ></CardContent>
          </Card>
        </div>
        <template #fallback><div class="text-muted-foreground">Loading charts…</div></template>
      </ClientOnly>

      <!-- Visitor profile breakdowns -->
      <ClientOnly>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Card
            v-for="dim in ['locale', 'country', 'device', 'browser', 'os', 'referer']"
            :key="dim"
          >
            <CardHeader
              ><CardTitle class="text-base capitalize">{{ dim }}</CardTitle></CardHeader
            >
            <CardContent>
              <p v-if="!stats.breakdowns[dim]?.length" class="text-sm text-muted-foreground">
                No data.
              </p>
              <div v-else class="h-48">
                <Bar :data="horizData(stats.breakdowns[dim]!.slice(0, 8))" :options="horizOpts" />
              </div>
            </CardContent>
          </Card>
        </div>
        <template #fallback><div class="text-muted-foreground">Loading charts…</div></template>
      </ClientOnly>
    </template>
  </div>
</template>
