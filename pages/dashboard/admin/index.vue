<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: ['auth', 'superadmin'] })
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-semibold tracking-tight sm:text-2xl">Admin Dashboard</h1>
      <p class="mt-1 text-sm text-muted-foreground">Site-wide analytics across every page.</p>
    </div>

    <!-- All-pages overview (KPIs + trend) -->
    <StatsOverview
      endpoint="/api/admin/stats/overview"
      :show-page-cards="false"
      page-link-base="/dashboard/admin/pages"
    />

    <div class="flex flex-wrap gap-3">
      <Button variant="outline" @click="navigateTo('/dashboard/admin/pages')"
        >Browse all pages</Button
      >
      <Button variant="outline" @click="navigateTo('/dashboard/admin/users')">Manage users</Button>
    </div>
  </div>
</template>
