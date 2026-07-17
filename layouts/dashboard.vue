<script setup lang="ts">
const { user, logout } = useAuth()
const isSuperAdmin = computed(() => user.value?.role === 'superadmin')
</script>

<template>
  <div class="min-h-screen bg-background">
    <header class="border-b">
      <div class="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-5 sm:py-3">
        <div class="flex items-center gap-4 sm:gap-6">
          <NuxtLink to="/dashboard" class="flex items-center gap-2 font-semibold">
            <span class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10 12 5 2 10l10 5 10-5Z" /><path d="M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5" /></svg>
            </span>
            <span class="hidden sm:inline">UNNC Freshmen Verifier Gateway</span>
            <span class="sm:hidden">UNNC VG</span>
          </NuxtLink>
          <NuxtLink v-if="isSuperAdmin" to="/dashboard/admin" class="text-sm text-muted-foreground hover:text-foreground">
            Users
          </NuxtLink>
        </div>
        <div class="flex items-center gap-2 text-sm sm:gap-3">
          <span v-if="isSuperAdmin" class="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">SA</span>
          <span class="hidden max-w-30 truncate text-muted-foreground sm:inline sm:max-w-none">{{ user?.email }}</span>
          <Button variant="outline" size="sm" @click="logout">Log out</Button>
        </div>
      </div>
    </header>
    <main class="mx-auto w-full max-w-5xl px-4 py-6 sm:px-5 sm:py-8">
      <slot />
    </main>
  </div>
</template>
