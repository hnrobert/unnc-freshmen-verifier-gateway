<script setup lang="ts">
import { Line } from 'vue-chartjs'
import type { ChartOptions } from 'chart.js'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()

const RANGES = ['7', '30', '90', 'all'] as const
const range = computed(() =>
  (RANGES as readonly string[]).includes(String(route.query.range))
    ? String(route.query.range)
    : '7',
)

interface OverviewOrg {
  id: number
  slug: string
  name: string
  role: string
  totals: { views: number; verifyTotal: number; admitted: number; successRate: number | null }
  spark: number[]
}
interface Overview {
  range: number
  totals: {
    views: number
    uniqueVisitors: number
    verifyTotal: number
    admitted: number
    notFound: number
    error: number
    successRate: number | null
  }
  daily: {
    days: string[]
    views: number[]
    uniqueVisitors: (number | null)[]
    verifyTotal: number[]
    admitted: number[]
  }
  orgs: OverviewOrg[]
}

const { data: overview, pending } = await useFetch<Overview>(
  () => `/api/stats/overview?range=${range.value}`,
  { watch: [range] },
)

function setRange(r: string) {
  router.push({ query: { ...route.query, range: r } })
}

const trendData = computed(() => ({
  labels: overview.value?.daily.days ?? [],
  datasets: [
    {
      label: 'Page views',
      data: overview.value?.daily.views ?? [],
      borderColor: '#F7D447',
      backgroundColor: 'rgba(247,212,71,0.15)',
      fill: true,
      tension: 0.3,
      pointRadius: 2,
    },
    {
      label: 'Verifications',
      data: overview.value?.daily.verifyTotal ?? [],
      borderColor: '#3b82f6',
      tension: 0.3,
      pointRadius: 2,
    },
  ],
}))
const trendOpts: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#888' } } },
  scales: {
    x: { ticks: { color: '#888' }, grid: { color: 'rgba(120,120,120,0.15)' } },
    y: { ticks: { color: '#888' }, grid: { color: 'rgba(120,120,120,0.15)' }, beginAtZero: true },
  },
}

const pct = (v: number | null) => (v === null ? '—' : `${(v * 100).toFixed(1)}%`)

/** Build an SVG polyline points string for a sparkline (normalized to w×h). */
function sparkPoints(data: number[], w = 140, h = 36): string {
  if (data.length < 2) return ''
  const max = Math.max(...data, 1)
  const step = w / (data.length - 1)
  return data.map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`).join(' ')
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold tracking-tight sm:text-2xl">Dashboard</h1>
        <p class="mt-1 text-sm text-muted-foreground">Analytics across all your organizations.</p>
      </div>
      <div class="flex items-center gap-2">
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
        <Button @click="navigateTo('/dashboard/new')">New organization</Button>
      </div>
    </div>

    <div v-if="pending" class="text-muted-foreground">Loading…</div>

    <!-- Empty state: no orgs at all -->
    <div
      v-else-if="!overview?.orgs?.length"
      class="rounded-lg border border-dashed p-12 text-center"
    >
      <p class="text-muted-foreground">
        No organizations yet — create one to start collecting data.
      </p>
      <Button class="mt-4" @click="navigateTo('/dashboard/new')">Create your first org</Button>
    </div>

    <template v-else-if="overview">
      <!-- Aggregate KPIs -->
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card
          ><CardContent class="p-4"
            ><div class="text-xs text-muted-foreground">Views</div>
            <div class="text-2xl font-semibold">{{ overview.totals.views }}</div></CardContent
          ></Card
        >
        <Card
          ><CardContent class="p-4"
            ><div class="text-xs text-muted-foreground">Unique visitors</div>
            <div class="text-2xl font-semibold">
              {{ overview.totals.uniqueVisitors }}
            </div></CardContent
          ></Card
        >
        <Card
          ><CardContent class="p-4"
            ><div class="text-xs text-muted-foreground">Verifications</div>
            <div class="text-2xl font-semibold">{{ overview.totals.verifyTotal }}</div></CardContent
          ></Card
        >
        <Card
          ><CardContent class="p-4"
            ><div class="text-xs text-muted-foreground">Success rate</div>
            <div class="text-2xl font-semibold">
              {{ pct(overview.totals.successRate) }}
            </div></CardContent
          ></Card
        >
      </div>

      <p v-if="range === 'all'" class="text-xs text-muted-foreground">
        Totals are all-time; trends and unique visitors reflect the 90-day raw-event window.
      </p>

      <!-- Aggregate trend -->
      <ClientOnly v-if="range !== 'all'">
        <Card>
          <CardHeader
            ><CardTitle class="text-base">Views &amp; verifications</CardTitle></CardHeader
          >
          <CardContent
            ><div class="h-64"><Line :data="trendData" :options="trendOpts" /></div
          ></CardContent>
        </Card>
        <template #fallback><div class="text-muted-foreground">Loading chart…</div></template>
      </ClientOnly>

      <!-- Per-org cards -->
      <div>
        <h2 class="mb-3 text-sm font-medium text-muted-foreground">By organization</h2>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="org in overview.orgs"
            :key="org.id"
            class="flex flex-col gap-3 rounded-lg border p-4"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span class="truncate font-medium">{{ org.name }}</span>
                  <span
                    v-if="org.role !== 'owner'"
                    class="rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                    >{{ org.role }}</span
                  >
                </div>
                <div class="text-xs text-muted-foreground">/{{ org.slug }}</div>
              </div>
            </div>

            <!-- Sparkline -->
            <svg
              v-if="sparkPoints(org.spark)"
              viewBox="0 0 140 36"
              preserveAspectRatio="none"
              class="h-9 w-full text-primary"
            >
              <polyline
                :points="sparkPoints(org.spark)"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linejoin="round"
                stroke-linecap="round"
              />
            </svg>
            <div v-else class="h-9" />

            <!-- KPIs -->
            <div class="grid grid-cols-3 gap-2 text-center">
              <div>
                <div class="text-lg font-semibold">{{ org.totals.views }}</div>
                <div class="text-[11px] text-muted-foreground">views</div>
              </div>
              <div>
                <div class="text-lg font-semibold">{{ org.totals.verifyTotal }}</div>
                <div class="text-[11px] text-muted-foreground">verifies</div>
              </div>
              <div>
                <div class="text-lg font-semibold">{{ pct(org.totals.successRate) }}</div>
                <div class="text-[11px] text-muted-foreground">success</div>
              </div>
            </div>

            <Button variant="outline" size="sm" @click="navigateTo(`/dashboard/${org.slug}/stats`)">
              View stats →
            </Button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
