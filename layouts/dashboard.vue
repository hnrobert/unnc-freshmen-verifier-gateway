<script setup lang="ts">
const { user, logout } = useAuth()
</script>

<template>
  <div class="min-h-screen bg-background">
    <header class="border-b">
      <div class="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-3">
        <NuxtLink to="/dashboard" class="flex items-center gap-2 font-semibold">
          <span class="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10 12 5 2 10l10 5 10-5Z" /><path d="M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5" /></svg>
          </span>
          UNNC Freshmen Verifier Gateway
        </NuxtLink>
        <div class="flex items-center gap-3 text-sm">
          <span class="text-muted-foreground">{{ user?.email }}</span>
          <Button variant="outline" size="sm" @click="logout">Log out</Button>
        </div>
      </div>
    </header>
    <main class="mx-auto w-full max-w-5xl px-5 py-8">
      <slot />
    </main>
  </div>
</template>
