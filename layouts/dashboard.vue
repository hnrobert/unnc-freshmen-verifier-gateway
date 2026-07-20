<script setup lang="ts">
import { useColorMode } from '@vueuse/core'
// Explicit import: the global <NuxtLink> resolves to a literal <RouterLink> tag
// when nested inside auto-imported components (BreadcrumbItem) during prod SSR.
// Importing it binds a real reference that resolves everywhere.
import { NuxtLink } from '#components'

const { user, logout } = useAuth()
const isSuperAdmin = computed(() => user.value?.role === 'superadmin')
const sidebarOpen = ref(false)
const route = useRoute()
const trail = useBreadcrumbs()

watch(
  () => route.path,
  () => {
    sidebarOpen.value = false
  },
)

// Dashboard theme toggle (standalone — no org config needed)
const mode = useColorMode({ storageKey: 'vg.theme' })
function toggleTheme() {
  mode.value = mode.value === 'dark' ? 'light' : 'dark'
}

// Org tab bar (Home / Edit / Advanced / Members / Share) for an org's dashboard
// area. Rendered in the sticky full-width header so the breadcrumb + tabs span
// the main column (not the centered content box) and stay pinned.
const RESERVED_SEGS = new Set(['', 'admin', 'orgs', 'settings', 'new'])
const orgSlug = computed(() => {
  const seg = route.path.split('/')[2] ?? ''
  return RESERVED_SEGS.has(seg) ? '' : seg
})
const { data: orgList } = useFetch<{ orgs: { slug: string; name: string; role: string }[] }>(
  '/api/orgs',
)
const currentOrg = computed(() =>
  orgSlug.value ? orgList.value?.orgs.find((o) => o.slug === orgSlug.value) : undefined,
)
const orgTabs = computed(() => {
  const s = orgSlug.value
  if (!s || !currentOrg.value) return []
  const canEdit = ['owner', 'manager', 'editor', 'superadmin'].includes(currentOrg.value.role)
  const canManage = ['owner', 'manager', 'superadmin'].includes(currentOrg.value.role)
  return [
    { label: 'Home', to: `/dashboard/${s}`, exact: true, show: true },
    { label: 'Edit', to: `/dashboard/${s}/edit`, exact: false, show: canEdit },
    { label: 'Advanced', to: `/dashboard/${s}/advanced`, exact: false, show: canEdit },
    { label: 'Members', to: `/dashboard/${s}/members`, exact: false, show: canManage },
    { label: 'Share', to: `/dashboard/${s}/share`, exact: false, show: true },
  ]
})
function tabActive(to: string, exact: boolean) {
  return exact ? route.path === to : route.path.startsWith(to)
}
</script>

<template>
  <div class="flex min-h-screen bg-background">
    <!-- Mobile overlay -->
    <div
      v-if="sidebarOpen"
      class="fixed inset-0 z-30 bg-black/40 lg:hidden"
      @click="sidebarOpen = false"
    />

    <!-- Sidebar -->
    <aside
      class="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r bg-card transition-transform duration-200 lg:translate-x-0"
      :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <!-- Brand -->
      <div class="flex h-14 items-center gap-2 border-b px-5">
        <img src="/favicon.svg" alt="" class="size-8 shrink-0 rounded-lg" />
        <span class="flex-1 text-sm font-semibold leading-tight"
          >UNNC Freshmen<br />Verifier Gateway</span
        >
        <button
          class="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-all hover:scale-105 hover:bg-accent hover:text-foreground"
          :title="mode === 'dark' ? 'Light mode' : 'Dark mode'"
          @click="toggleTheme"
        >
          <Icon :spec="mode === 'dark' ? 'Sun' : 'Moon'" :size="16" />
        </button>
      </div>

      <!-- Nav -->
      <nav class="flex-1 space-y-1 p-3">
        <NuxtLink
          to="/dashboard"
          class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:translate-x-0.5"
          :class="
            route.path === '/dashboard'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          "
        >
          <Icon spec="LayoutDashboard" :size="16" />
          Dashboard
        </NuxtLink>
        <NuxtLink
          to="/dashboard/orgs"
          class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:translate-x-0.5"
          :class="
            route.path === '/dashboard/orgs'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          "
        >
          <Icon spec="Building2" :size="16" />
          Organizations
        </NuxtLink>

        <!-- Settings (user account: email / password / passkeys / mail) -->
        <NuxtLink
          to="/dashboard/settings"
          class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:translate-x-0.5"
          :class="
            route.path === '/dashboard/settings'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          "
        >
          <Icon spec="Settings" :size="16" />
          Settings
        </NuxtLink>

        <!-- Superadmin section (site-wide: orgs / users / registration) -->
        <template v-if="isSuperAdmin">
          <div
            class="px-3 pt-4 pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground/60"
          >
            Admin
          </div>
          <NuxtLink
            to="/dashboard/admin"
            class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:translate-x-0.5"
            :class="
              route.path === '/dashboard/admin'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            "
          >
            <Icon spec="Building2" :size="16" />
            All Organizations
          </NuxtLink>
          <NuxtLink
            to="/dashboard/admin/users"
            class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:translate-x-0.5"
            :class="
              route.path === '/dashboard/admin/users'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            "
          >
            <Icon spec="Users" :size="16" />
            Users
          </NuxtLink>
          <NuxtLink
            to="/dashboard/admin/registration"
            class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:translate-x-0.5"
            :class="
              route.path === '/dashboard/admin/registration'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            "
          >
            <Icon spec="UserCheck" :size="16" />
            Registration
          </NuxtLink>
          <NuxtLink
            to="/dashboard/admin/mail"
            class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:translate-x-0.5"
            :class="
              route.path === '/dashboard/admin/mail'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            "
          >
            <Icon spec="Mail" :size="16" />
            Mail
          </NuxtLink>
        </template>
      </nav>

      <!-- User -->
      <div class="border-t p-3">
        <div class="mb-2 flex items-center gap-2 px-3">
          <span
            v-if="isSuperAdmin"
            class="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground"
            >SA</span
          >
          <span class="min-w-0 flex-1 truncate text-sm text-muted-foreground">{{
            user?.email
          }}</span>
        </div>
        <button
          class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-all hover:translate-x-0.5 hover:bg-accent hover:text-foreground"
          @click="logout"
        >
          <Icon spec="LogOut" :size="16" />
          Log out
        </button>
      </div>
    </aside>

    <!-- Main -->
    <div class="flex flex-1 flex-col lg:pl-64">
      <!-- Mobile top bar -->
      <header
        class="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur lg:hidden"
      >
        <button
          class="flex size-9 items-center justify-center rounded-lg border text-muted-foreground transition-all hover:scale-105 hover:bg-accent hover:text-foreground active:scale-95"
          @click="sidebarOpen = true"
        >
          <Icon spec="Menu" :size="20" />
        </button>
        <span class="text-sm font-semibold">UNNC Freshmen Verifier Gateway</span>
        <!-- Theme toggle -->
        <button
          class="ml-auto flex size-8 items-center justify-center rounded-lg border text-muted-foreground transition-all hover:scale-105 hover:bg-accent hover:text-foreground"
          @click="toggleTheme"
        >
          <Icon :spec="mode === 'dark' ? 'Sun' : 'Moon'" :size="16" />
        </button>
      </header>

      <main class="flex-1">
        <!-- Sticky full-width header: breadcrumb + (on org pages) the org tabs.
             top-14 on mobile to sit under the mobile top bar, top-0 on desktop. -->
        <div class="sticky top-14 z-10 bg-background/95 backdrop-blur lg:top-0">
          <div v-if="trail.length > 1" class="border-b px-4 py-2.5 sm:px-6 lg:px-8">
            <Breadcrumb>
              <BreadcrumbList>
                <template v-for="(item, i) in trail" :key="i">
                  <BreadcrumbItem>
                    <!-- NuxtLink authored here (not via <BreadcrumbLink as-child>) because
                         reka-ui's Primitive (BreadcrumbLink) renders null in prod SSR here. -->
                    <NuxtLink
                      v-if="item.to"
                      :to="item.to"
                      class="transition-colors hover:text-foreground"
                      >{{ item.label }}</NuxtLink
                    >
                    <BreadcrumbPage v-else>{{ item.label }}</BreadcrumbPage>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator v-if="i < trail.length - 1" />
                </template>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <nav
            v-if="orgTabs.length"
            class="flex gap-1 overflow-x-auto border-b px-4 sm:px-6 lg:px-8"
          >
            <NuxtLink
              v-for="tab in orgTabs"
              v-show="tab.show"
              :key="tab.to"
              :to="tab.to"
              class="-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors"
              :class="
                tabActive(tab.to, tab.exact)
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              "
              >{{ tab.label }}</NuxtLink
            >
          </nav>
        </div>
        <!-- Page content (centered) -->
        <div class="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div class="mx-auto w-full max-w-4xl"><slot /></div>
        </div>
      </main>
      <SiteFooter />
    </div>
  </div>
</template>
