<script setup lang="ts">
definePageMeta({ layout: 'default', middleware: ['auth'] })

const route = useRoute()
const slug = computed(() => route.params.slug as string)

const { data: invite, error } = await useFetch<{
  pageName: string
  slug: string
  role: string
  inviteToken: string
}>(() => `/api/pages/${slug.value}/invitation`)

const claiming = ref(false)
const declining = ref(false)

async function onAccept() {
  if (!invite.value) return
  claiming.value = true
  try {
    await $fetch(`/api/invites/${invite.value.inviteToken}/claim`, { method: 'POST' })
    toast.success('Invitation accepted')
    await navigateTo(`/dashboard/${slug.value}`)
  } catch (e) {
    toast.error(messageFromError(e, 'Could not accept'))
  } finally {
    claiming.value = false
  }
}

async function onDecline() {
  if (!invite.value) return
  declining.value = true
  try {
    await $fetch(`/api/invites/${invite.value.inviteToken}/decline`, { method: 'POST' })
    toast.success('Invitation declined')
    await navigateTo('/dashboard')
  } catch (e) {
    toast.error(messageFromError(e, 'Could not decline'))
  } finally {
    declining.value = false
  }
}
</script>

<template>
  <Card class="mx-auto mt-2 max-w-md">
    <CardHeader>
      <CardTitle>Page invitation</CardTitle>
      <CardDescription v-if="invite">
        You've been invited to join as <strong>{{ invite.role }}</strong
        >.
      </CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-4">
      <StatusAlert
        v-if="error"
        variant="error"
        message="No pending invitation found for your account."
      />
      <template v-else-if="invite">
        <p class="text-sm text-muted-foreground">
          Accept to join this page and access its dashboard.
        </p>
        <div class="flex gap-2">
          <Button :disabled="claiming" @click="onAccept">
            {{ claiming ? 'Accepting…' : 'Accept invitation' }}
          </Button>
          <Button variant="outline" :disabled="declining" @click="onDecline">
            {{ declining ? '…' : 'Decline' }}
          </Button>
        </div>
      </template>
    </CardContent>
  </Card>
</template>
