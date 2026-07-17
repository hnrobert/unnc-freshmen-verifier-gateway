<script setup lang="ts">
const { user, logout } = useAuth()
const isSuperAdmin = computed(() => user.value?.role === 'superadmin')
const sidebarOpen = ref(false)
const route = useRoute()

watch(() => route.path, () => { sidebarOpen.value = false })
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
        <span class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10 12 5 2 10l10 5 10-5Z" /><path d="M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5" /></svg>
        </span>
        <span class="text-sm font-semibold leading-tight">UNNC Verifier<br />Gateway</span>
      </div>

      <!-- Nav -->
      <nav class="flex-1 space-y-1 p-3">
        <NuxtLink
          to="/dashboard"
          class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:translate-x-0.5"
          :class="route.path === '/dashboard' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'"
        >
          <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
          Dashboard
        </NuxtLink>

        <!-- Superadmin section -->
        <template v-if="isSuperAdmin">
          <div class="px-3 pt-4 pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground/60">Admin</div>
          <NuxtLink
            to="/dashboard/admin?tab=orgs"
            class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:translate-x-0.5"
            :class="route.path === '/dashboard/admin' && route.query.tab !== 'users' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'"
          >
            <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" /></svg>
            All Organizations
          </NuxtLink>
          <NuxtLink
            to="/dashboard/admin?tab=users"
            class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:translate-x-0.5"
            :class="route.path === '/dashboard/admin' && route.query.tab === 'users' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'"
          >
            <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            Users
          </NuxtLink>
        </template>
      </nav>

      <!-- User -->
      <div class="border-t p-3">
        <div class="mb-2 flex items-center gap-2 px-3">
          <span v-if="isSuperAdmin" class="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">SA</span>
          <span class="min-w-0 flex-1 truncate text-sm text-muted-foreground">{{ user?.email }}</span>
        </div>
        <button
          class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-all hover:translate-x-0.5 hover:bg-accent hover:text-foreground"
          @click="logout"
        >
          <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>
          Log out
        </button>
      </div>
    </aside>

    <!-- Main -->
    <div class="flex flex-1 flex-col lg:pl-64">
      <!-- Mobile top bar -->
      <header class="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur lg:hidden">
        <button
          class="flex size-9 items-center justify-center rounded-lg border text-muted-foreground transition-all hover:scale-105 hover:bg-accent hover:text-foreground active:scale-95"
          @click="sidebarOpen = true"
        >
          <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" x2="21" y1="6" y2="6" /><line x1="3" x2="21" y1="12" y2="12" /><line x1="3" x2="21" y1="18" y2="18" /></svg>
        </button>
        <span class="text-sm font-semibold">UNNC VG</span>
      </header>

      <main class="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div class="mx-auto w-full max-w-4xl">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>
