<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const route = useRoute()
const token = computed(() => route.params.token as string)
const { user } = useAuth()

const { data: invite, error } = await useFetch<{
  orgName: string
  slug: string | null
  invitedEmail: string
  role: string
  status: string
  expired: boolean
}>(() => `/api/invites/${token.value}`)

const emailMatches = computed(
  () =>
    !!user.value?.email &&
    !!invite.value &&
    user.value.email.toLowerCase() === invite.value.invitedEmail.toLowerCase(),
)
const claimed = computed(() => invite.value?.status === 'active')
const claiming = ref(false)

async function onAccept() {
  claiming.value = true
  try {
    await $fetch(`/api/invites/${token.value}/claim`, { method: 'POST' })
    toast.success('Invitation accepted')
    await navigateTo('/dashboard')
  } catch (e) {
    toast.error(messageFromError(e, 'Could not accept invitation'))
  } finally {
    claiming.value = false
  }
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Organization invitation</CardTitle>
      <CardDescription v-if="invite">
        You've been invited to <strong>{{ invite.orgName }}</strong> as
        <span class="font-medium">{{ invite.role }}</span
        >.
      </CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-4">
      <StatusAlert v-if="error" variant="error" message="This invitation could not be found." />

      <template v-else-if="invite">
        <StatusAlert
          v-if="invite.expired"
          variant="error"
          message="This invitation has expired. Ask the org owner to send a new one."
        />
        <StatusAlert
          v-else-if="claimed"
          variant="error"
          message="This invitation has already been used."
        />

        <template v-else>
          <p class="text-sm text-muted-foreground">
            Invited email: <code>{{ invite.invitedEmail }}</code>
          </p>

          <!-- Not logged in -->
          <div v-if="!user" class="flex flex-col gap-2">
            <p class="text-sm">Sign in (or register) with that email to accept.</p>
            <Button @click="navigateTo(`/login?redirect=${encodeURIComponent(`/invite/${token}`)}`)"
              >Sign in</Button
            >
          </div>

          <!-- Logged in but wrong email -->
          <StatusAlert
            v-else-if="!emailMatches"
            variant="error"
            :message="`This invitation is for ${invite.invitedEmail}, but you're signed in as ${user.email}. Sign out and use the invited email.`"
          />

          <!-- Good to go -->
          <Button v-else :disabled="claiming" @click="onAccept">
            {{ claiming ? 'Accepting…' : 'Accept invitation' }}
          </Button>
        </template>
      </template>
    </CardContent>
  </Card>
</template>
