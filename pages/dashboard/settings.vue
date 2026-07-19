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

// --- Mail / SMTP (per-user sender) ---
interface MailConfigView {
  smtpServer: string
  smtpPort: number
  useSsl: boolean
  useTls: boolean
  usePassword: boolean
  senderEmail: string
  senderEmailDisplay: string
  senderDomain: string
  hasPassword: boolean
  maxLenRecipientEmail: number
  maxLenSubject: number
  maxLenBody: number
}
const { data: mail } = await useFetch<MailConfigView>('/api/mail/config')
const mailPassword = ref('')
const mailSaving = ref(false)
const mailTesting = ref(false)
const testRecipient = ref(user.value?.email ?? '')

async function onSaveMail(): Promise<void> {
  if (!mail.value) return
  mailSaving.value = true
  try {
    const res = await $fetch<MailConfigView>('/api/mail/config', {
      method: 'PUT',
      body: { ...mail.value, senderPassword: mailPassword.value },
    })
    mail.value = res
    mailPassword.value = ''
    toast.success('Mail settings saved')
  } catch (e) {
    toast.error(messageFromError(e, 'Save failed'))
  } finally {
    mailSaving.value = false
  }
}

async function onSendTest(): Promise<void> {
  if (!mail.value) return
  mailTesting.value = true
  try {
    await $fetch('/api/mail/test', { method: 'POST', body: { to: testRecipient.value } })
    toast.success('Test email sent')
  } catch (e) {
    toast.error(messageFromError(e, 'Test send failed'))
  } finally {
    mailTesting.value = false
  }
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

    <!-- Mail / SMTP (per-user sender) -->
    <Card v-if="mail">
      <CardHeader>
        <CardTitle class="text-base">Mail (SMTP)</CardTitle>
        <CardDescription>
          Per-user sender — outgoing mail uses these SMTP + sender settings. Different users can
          send from different mailboxes.
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="flex flex-col gap-2">
            <Label for="mail-smtp">SMTP server</Label>
            <Input
              id="mail-smtp"
              v-model="mail.smtpServer"
              placeholder="smtp.example.com"
              :disabled="mailSaving"
            />
          </div>
          <div class="flex flex-col gap-2">
            <Label for="mail-port">Port</Label>
            <Input
              id="mail-port"
              v-model.number="mail.smtpPort"
              type="number"
              placeholder="587"
              :disabled="mailSaving"
            />
          </div>
        </div>
        <div class="flex flex-wrap gap-x-6 gap-y-2">
          <label class="flex items-center gap-2 text-sm">
            <input
              v-model="mail.useSsl"
              type="checkbox"
              class="size-4 rounded border"
              :disabled="mailSaving"
            />
            SSL (implicit TLS)
          </label>
          <label class="flex items-center gap-2 text-sm">
            <input
              v-model="mail.useTls"
              type="checkbox"
              class="size-4 rounded border"
              :disabled="mailSaving"
            />
            STARTTLS
          </label>
          <label class="flex items-center gap-2 text-sm">
            <input
              v-model="mail.usePassword"
              type="checkbox"
              class="size-4 rounded border"
              :disabled="mailSaving"
            />
            Authenticate
          </label>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="flex flex-col gap-2">
            <Label for="mail-from">Sender email (SMTP login)</Label>
            <Input
              id="mail-from"
              v-model="mail.senderEmail"
              placeholder="you@example.com"
              :disabled="mailSaving"
            />
          </div>
          <div class="flex flex-col gap-2">
            <Label for="mail-display">Display From (optional)</Label>
            <Input
              id="mail-display"
              v-model="mail.senderEmailDisplay"
              placeholder="UNNC Verifier"
              :disabled="mailSaving"
            />
          </div>
          <div class="flex flex-col gap-2">
            <Label for="mail-domain">Sender domain (Message-ID)</Label>
            <Input
              id="mail-domain"
              v-model="mail.senderDomain"
              placeholder="example.com"
              :disabled="mailSaving"
            />
          </div>
          <div class="flex flex-col gap-2">
            <Label for="mail-pass">Sender password</Label>
            <Input
              id="mail-pass"
              v-model="mailPassword"
              type="password"
              :placeholder="mail.hasPassword ? '(unchanged — leave blank to keep)' : ''"
              autocomplete="new-password"
              :disabled="mailSaving || !mail.usePassword"
            />
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <Button size="sm" :disabled="mailSaving" @click="onSaveMail">{{
            mailSaving ? 'Saving…' : 'Save mail settings'
          }}</Button>
          <span class="mx-1 h-5 w-px bg-border"></span>
          <Input
            v-model="testRecipient"
            type="email"
            class="h-9 w-56"
            placeholder="test recipient"
            :disabled="mailTesting"
          />
          <Button
            variant="outline"
            size="sm"
            :disabled="mailTesting || (!mail.hasPassword && !mailPassword) || !mail.smtpServer"
            @click="onSendTest"
            >{{ mailTesting ? 'Sending…' : 'Send test' }}</Button
          >
        </div>
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
