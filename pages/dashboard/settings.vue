<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const { user, listPasskeys, addPasskey, removePasskey } = useAuth()

// Single draft for the whole page (email + password), saved together via the
// bottom save/discard bar — same pattern as the config editor.
const originalEmail = ref(user.value?.email ?? '')
const draft = ref({ email: originalEmail.value, currentPassword: '', newPassword: '', confirm: '' })
const saving = ref(false)
const saved = ref(false)

const isDirty = computed(
  () =>
    draft.value.email !== originalEmail.value ||
    !!draft.value.currentPassword ||
    !!draft.value.newPassword ||
    !!draft.value.confirm,
)

// Unsaved-changes prompt on leave (matches the config editor).
const { confirmLeave, proceed } = useUnsavedLeaveGuard(isDirty, saving)

async function onSave(): Promise<void> {
  if (draft.value.newPassword !== draft.value.confirm) {
    toast.error('New passwords do not match')
    return
  }
  const body: Record<string, string> = {}
  if (draft.value.email.trim().toLowerCase() !== originalEmail.value) {
    body.email = draft.value.email.trim().toLowerCase()
  }
  if (draft.value.newPassword) {
    body.currentPassword = draft.value.currentPassword
    body.newPassword = draft.value.newPassword
  }
  if (Object.keys(body).length === 0) return

  saving.value = true
  saved.value = false
  try {
    const res = await $fetch<{ user: { email: string } }>('/api/auth/me', { method: 'PATCH', body })
    originalEmail.value = res.user.email
    if (user.value) user.value.email = res.user.email
    draft.value = { email: res.user.email, currentPassword: '', newPassword: '', confirm: '' }
    saved.value = true
    setTimeout(() => (saved.value = false), 2000)
  } catch (e) {
    toast.error(messageFromError(e, 'Failed to save'))
  } finally {
    saving.value = false
  }
}

function onDiscard(): void {
  draft.value = { email: originalEmail.value, currentPassword: '', newPassword: '', confirm: '' }
}

// --- Passkeys (independent of the email/password draft above) ---
type PasskeyInfo = Awaited<ReturnType<typeof listPasskeys>>[number]
const passkeys = ref<PasskeyInfo[]>([])
const pkLoading = ref(false)
const removingId = ref<number | null>(null)

async function loadPasskeys(): Promise<void> {
  try {
    passkeys.value = await listPasskeys()
  } catch {
    /* best-effort */
  }
}
async function onAddPasskey(): Promise<void> {
  pkLoading.value = true
  try {
    passkeys.value = await addPasskey()
    toast.success('Passkey added')
  } catch (e) {
    toast.error(messageFromError(e, 'Could not add passkey'))
  } finally {
    pkLoading.value = false
  }
}
async function onRemovePasskey(id: number): Promise<void> {
  removingId.value = id
  try {
    passkeys.value = await removePasskey(id)
    toast.success('Passkey removed')
  } catch (e) {
    toast.error(messageFromError(e, 'Could not remove passkey'))
  } finally {
    removingId.value = null
  }
}
function passkeyLabel(p: PasskeyInfo): string {
  if (p.deviceType === 'multiDevice') return 'Synced passkey'
  if (p.deviceType === 'singleDevice') return 'Device passkey'
  return 'Passkey'
}
onMounted(loadPasskeys)
</script>

<template>
  <div class="max-w-md space-y-8 pb-24">
    <h1 class="text-xl font-semibold tracking-tight sm:text-2xl">Settings</h1>

    <!-- Email -->
    <Card>
      <CardHeader>
        <CardTitle class="text-base">Email</CardTitle>
        <CardDescription>Change the email associated with your account.</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="flex flex-col gap-2">
          <Label for="settings-email">New email</Label>
          <Input id="settings-email" v-model="draft.email" type="email" :disabled="saving" />
        </div>
      </CardContent>
    </Card>

    <!-- Password -->
    <Card>
      <CardHeader>
        <CardTitle class="text-base">Password</CardTitle>
        <CardDescription>Change your password. Current password required.</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <Label for="settings-pw-current">Current password</Label>
          <Input
            id="settings-pw-current"
            v-model="draft.currentPassword"
            type="password"
            placeholder="••••••••"
            autocomplete="current-password"
            :disabled="saving"
          />
        </div>
        <div class="flex flex-col gap-2">
          <Label for="settings-pw-new">New password</Label>
          <Input
            id="settings-pw-new"
            v-model="draft.newPassword"
            type="password"
            placeholder="min 8 characters"
            autocomplete="new-password"
            :disabled="saving"
          />
        </div>
        <div class="flex flex-col gap-2">
          <Label for="settings-pw-confirm">Confirm new password</Label>
          <Input
            id="settings-pw-confirm"
            v-model="draft.confirm"
            type="password"
            placeholder="re-enter password"
            autocomplete="new-password"
            :disabled="saving"
          />
        </div>
      </CardContent>
    </Card>

    <!-- Passkeys -->
    <Card>
      <CardHeader>
        <CardTitle class="text-base">Passkeys</CardTitle>
        <CardDescription
          >Sign in without a password using your device (Face&nbsp;ID, Touch&nbsp;ID, security
          key…). Requires HTTPS or localhost.</CardDescription
        >
      </CardHeader>
      <CardContent class="flex flex-col gap-4">
        <p v-if="!passkeys.length" class="text-sm text-muted-foreground">No passkeys yet.</p>
        <ul v-else class="flex flex-col gap-2">
          <li
            v-for="p in passkeys"
            :key="p.id"
            class="flex items-center justify-between gap-3 rounded-md border p-3"
          >
            <div class="min-w-0">
              <div class="truncate text-sm font-medium">{{ passkeyLabel(p) }}</div>
              <div class="text-xs text-muted-foreground">
                Added {{ new Date(p.createdAt).toLocaleDateString()
                }}<span v-if="p.backedUp"> · synced</span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              :disabled="removingId === p.id"
              @click="onRemovePasskey(p.id)"
            >
              {{ removingId === p.id ? '…' : 'Remove' }}
            </Button>
          </li>
        </ul>
        <Button variant="outline" size="sm" :disabled="pkLoading" @click="onAddPasskey">
          {{ pkLoading ? '…' : 'Add passkey' }}
        </Button>
      </CardContent>
    </Card>

    <!-- Sticky save/discard bar (dirty tracking + save logic live in this page) -->
    <SaveBar :dirty="isDirty" :saving="saving" :saved="saved" @save="onSave" @discard="onDiscard" />

    <!-- Unsaved changes leave dialog -->
    <UnsavedLeaveDialog
      :open="confirmLeave"
      :saving="saving"
      @stay="confirmLeave = false"
      @discard="
        () => {
          onDiscard()
          proceed()
        }
      "
      @save="
        async () => {
          await onSave()
          proceed()
        }
      "
    />
  </div>
</template>
