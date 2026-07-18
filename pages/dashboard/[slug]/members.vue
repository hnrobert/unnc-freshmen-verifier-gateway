<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const slug = computed(() => route.params.slug as string)
const { user } = useAuth()

const { data: access } = await useFetch<{ role: string | null; rank: number }>(
  () => `/api/orgs/${slug.value}/access`,
)
const {
  data: membersData,
  pending,
  refresh,
} = await useFetch<{
  owner: { email: string; role: string }
  members: {
    id: number
    email: string
    role: string
    status: string
    createdAt: string
    acceptedAt: string | null
  }[]
}>(() => `/api/orgs/${slug.value}/members`)

const isOwner = computed(() => access.value?.role === 'owner')
const canManage = computed(() => isOwner.value || access.value?.role === 'manager')
const myMemberId = computed(
  () => membersData.value?.members.find((m) => m.email === user.value?.email)?.id ?? null,
)
const canGrantManager = computed(() => isOwner.value)

// Invite form
const inviteEmail = ref('')
const inviteRole = ref('viewer')
const inviting = ref(false)
const lastInvite = ref<{ email: string; url: string } | null>(null)

async function onInvite() {
  inviting.value = true
  lastInvite.value = null
  try {
    const res = await $fetch<{ inviteUrl: string }>(`/api/orgs/${slug.value}/members`, {
      method: 'POST',
      body: { email: inviteEmail.value.trim().toLowerCase(), role: inviteRole.value },
    })
    lastInvite.value = { email: inviteEmail.value, url: res.inviteUrl }
    inviteEmail.value = ''
    toast.success('Invitation created — share the link')
    await refresh()
  } catch (e) {
    toast.error(messageFromError(e, 'Invite failed'))
  } finally {
    inviting.value = false
  }
}

async function onRoleChange(memberId: number, role: string) {
  try {
    await $fetch(`/api/orgs/${slug.value}/members/${memberId}`, { method: 'PATCH', body: { role } })
    toast.success('Role updated')
    await refresh()
  } catch (e) {
    toast.error(messageFromError(e, 'Update failed'))
    await refresh()
  }
}

async function onRemove(memberId: number) {
  if (!confirm('Remove this member?')) return
  try {
    await $fetch(`/api/orgs/${slug.value}/members/${memberId}`, { method: 'DELETE' })
    toast.success('Member removed')
    await refresh()
  } catch (e) {
    toast.error(messageFromError(e, 'Remove failed'))
  }
}

async function onTransfer(memberId: number) {
  if (!confirm('Transfer ownership to this member? You will become a manager.')) return
  try {
    await $fetch(`/api/orgs/${slug.value}/transfer`, { method: 'POST', body: { memberId } })
    toast.success('Ownership transferred')
    await refresh()
  } catch (e) {
    toast.error(messageFromError(e, 'Transfer failed'))
  }
}

async function onLeave() {
  if (myMemberId.value === null) return
  if (!confirm('Leave this organization?')) return
  try {
    await $fetch(`/api/orgs/${slug.value}/members/${myMemberId.value}`, { method: 'DELETE' })
    toast.success('You left the organization')
    await navigateTo('/dashboard')
  } catch (e) {
    toast.error(messageFromError(e, 'Leave failed'))
  }
}

async function copyUrl(url: string) {
  try {
    await navigator.clipboard.writeText(url)
    toast.success('Link copied')
  } catch {
    /* ignore */
  }
}
</script>

<template>
  <div class="max-w-3xl space-y-8">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold tracking-tight sm:text-2xl">
          Members · <code>/{{ slug }}</code>
        </h1>
        <p class="mt-1 text-sm text-muted-foreground">Invite others and manage their access.</p>
      </div>
      <Button v-if="myMemberId !== null" variant="outline" size="sm" @click="onLeave"
        >Leave org</Button
      >
    </div>

    <!-- Owner -->
    <Card v-if="membersData">
      <CardHeader>
        <CardTitle class="text-base">Owner</CardTitle>
      </CardHeader>
      <CardContent>
        <div class="flex items-center justify-between">
          <span class="font-medium">{{ membersData.owner.email }}</span>
          <span
            class="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground"
            >owner</span
          >
        </div>
      </CardContent>
    </Card>

    <!-- Members -->
    <Card v-if="membersData">
      <CardHeader>
        <CardTitle class="text-base">Members</CardTitle>
        <CardDescription>{{ membersData.members.length }} invited</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-2">
        <p v-if="!membersData.members.length" class="text-sm text-muted-foreground">
          No members yet.
        </p>
        <ul v-else class="flex flex-col gap-2">
          <li
            v-for="m in membersData.members"
            :key="m.id"
            class="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
          >
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="truncate text-sm font-medium">{{ m.email }}</span>
                <span
                  v-if="m.status === 'pending'"
                  class="rounded-full border px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground"
                  >pending</span
                >
              </div>
              <div class="text-xs text-muted-foreground">
                <template v-if="m.status === 'active' && m.acceptedAt"
                  >joined {{ new Date(m.acceptedAt).toLocaleDateString() }}</template
                >
                <template v-else>invited {{ new Date(m.createdAt).toLocaleDateString() }}</template>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <select
                :value="m.role"
                class="h-9 rounded-md border bg-transparent px-2 text-sm"
                :disabled="!canManage"
                @change="onRoleChange(m.id, ($event.target as HTMLSelectElement).value)"
              >
                <option value="viewer">viewer</option>
                <option value="editor">editor</option>
                <option value="manager">manager</option>
              </select>
              <Button
                v-if="isOwner && m.status === 'active'"
                variant="ghost"
                size="sm"
                @click="onTransfer(m.id)"
                >Make owner</Button
              >
              <Button variant="outline" size="sm" :disabled="!canManage" @click="onRemove(m.id)"
                >Remove</Button
              >
            </div>
          </li>
        </ul>
      </CardContent>
    </Card>

    <!-- Invite -->
    <Card v-if="canManage">
      <CardHeader>
        <CardTitle class="text-base">Invite by email</CardTitle>
        <CardDescription
          >The recipient must sign in with this exact email to accept.</CardDescription
        >
      </CardHeader>
      <CardContent class="flex flex-col gap-4">
        <form class="flex flex-col gap-3 sm:flex-row sm:items-end" @submit.prevent="onInvite">
          <div class="flex-1">
            <Label for="invite-email">Email</Label>
            <Input
              id="invite-email"
              v-model="inviteEmail"
              type="email"
              placeholder="them@example.com"
              :disabled="inviting"
            />
          </div>
          <div>
            <Label for="invite-role">Role</Label>
            <select
              id="invite-role"
              v-model="inviteRole"
              class="h-9 rounded-md border bg-transparent px-2 text-sm"
              :disabled="!canGrantManager"
            >
              <option value="viewer">viewer</option>
              <option value="editor">editor</option>
              <option v-if="canGrantManager" value="manager">manager</option>
            </select>
          </div>
          <Button type="submit" :disabled="inviting || !inviteEmail.trim()">{{
            inviting ? '…' : 'Invite'
          }}</Button>
        </form>

        <div
          v-if="lastInvite"
          class="flex items-center gap-2 rounded-md border bg-muted/40 p-3 text-sm"
        >
          <code class="min-w-0 flex-1 truncate">{{ lastInvite.url }}</code>
          <Button variant="outline" size="sm" @click="copyUrl(lastInvite!.url)">Copy</Button>
        </div>
        <p v-if="!canGrantManager" class="text-xs text-muted-foreground">
          Managers can invite viewers and editors; only the owner can invite managers.
        </p>
      </CardContent>
    </Card>

    <p v-else-if="access && !canManage" class="text-sm text-muted-foreground">
      You need manager access to manage members.
    </p>
    <div v-if="pending" class="text-muted-foreground">Loading…</div>
  </div>
</template>
