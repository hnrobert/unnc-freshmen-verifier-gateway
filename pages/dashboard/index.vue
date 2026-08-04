<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

// --- Pending org invitations (GitHub-style notification) ---
interface PendingInvite {
  token: string
  orgName: string
  slug: string
  role: string
}
const { data: invitesData, refresh: refreshInvites } = await useFetch<{
  invitations: PendingInvite[]
}>('/api/invites/pending')

async function onAcceptInvite(token: string, slug: string) {
  try {
    await $fetch(`/api/invites/${token}/claim`, { method: 'POST' })
    toast.success('Invitation accepted')
    await navigateTo(`/dashboard/${slug}`)
  } catch (e) {
    toast.error(messageFromError(e, 'Could not accept'))
  }
}
async function onDeclineInvite(token: string) {
  try {
    await $fetch(`/api/invites/${token}/decline`, { method: 'POST' })
    toast.success('Invitation declined')
    await refreshInvites()
  } catch (e) {
    toast.error(messageFromError(e, 'Could not decline'))
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Pending invitations -->
    <section v-if="invitesData?.invitations?.length" class="space-y-3">
      <h2 class="text-sm font-medium text-muted-foreground">Pending invitations</h2>
      <div
        v-for="inv in invitesData.invitations"
        :key="inv.token"
        class="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
      >
        <div class="flex items-center gap-2">
          <Icon spec="Building2" :size="18" />
          <span class="font-medium">{{ inv.orgName }}</span>
          <span
            class="rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
            >{{ inv.role }}</span
          >
        </div>
        <div class="flex gap-2">
          <Button size="sm" @click="onAcceptInvite(inv.token, inv.slug)">Accept</Button>
          <Button variant="outline" size="sm" @click="onDeclineInvite(inv.token)">Decline</Button>
        </div>
      </div>
    </section>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold tracking-tight sm:text-2xl">Dashboard</h1>
        <p class="mt-1 text-sm text-muted-foreground">Analytics across your organizations.</p>
      </div>
      <Button @click="navigateTo('/dashboard/new')">New organization</Button>
    </div>

    <!-- Overview: range selector + KPIs + trend + per-org cards (scoped to this user's orgs) -->
    <StatsOverview endpoint="/api/stats/overview" />
  </div>
</template>
