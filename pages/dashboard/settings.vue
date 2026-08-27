<script setup lang="ts">
import type { ReminderSlot } from '#shared/types'
import { SYSTEM_DEFAULT_SLOTS } from '#shared/lib/reminderPref'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const { user, listPasskeys, addPasskey, removePasskey } = useAuth()

// --- Account data: one /api/auth/me fetch seeds the originals below. ---
interface MeData {
  user: { id: number; email: string; role: string }
  notifyExpiry: boolean
  tz: string | null
  reminderSlots: ReminderSlot[] | null
  reminderTime: string | null
}
const { data: meData } = await useFetch<MeData>('/api/auth/me')
const { data: timezones } = await useFetch<string[]>('/api/timezones')

// Single draft for the WHOLE page — email (+ verification code), password, and
// notification preferences — saved together via the bottom save/discard bar
// (same pattern as the config editor). `originalX` snapshots drive isDirty and
// Discard; the PATCH only sends fields that actually changed.
// Unset account values are seeded from the system default (2 days / 1 day /
// day-of at 12:00 server tz) so the card shows what's actually in effect. An
// untouched seeded draft isn't dirty, so `null` (inherit) is preserved on save.
const originalEmail = ref(user.value?.email ?? '')
const originalNotify = ref(meData.value?.notifyExpiry ?? true)
const originalSlots = ref<ReminderSlot[]>(meData.value?.reminderSlots ?? [...SYSTEM_DEFAULT_SLOTS])
const originalTime = ref(meData.value?.reminderTime ?? '12:00')
const originalTz = ref<string | null>(meData.value?.tz ?? null)

const draft = ref({
  email: originalEmail.value,
  currentPassword: '',
  newPassword: '',
  confirm: '',
  notifyExpiry: originalNotify.value,
  reminderSlots: [...originalSlots.value] as ReminderSlot[],
  reminderTime: originalTime.value,
  tz: originalTz.value as string | null,
})

function slotsEqual(a: ReminderSlot[], b: ReminderSlot[]): boolean {
  if (a.length !== b.length) return false
  return a.every((s) => b.includes(s))
}

const isDirty = computed(
  () =>
    draft.value.email.trim().toLowerCase() !== originalEmail.value ||
    !!draft.value.currentPassword ||
    !!draft.value.newPassword ||
    !!draft.value.confirm ||
    draft.value.notifyExpiry !== originalNotify.value ||
    draft.value.reminderTime !== originalTime.value ||
    draft.value.tz !== originalTz.value ||
    !slotsEqual(draft.value.reminderSlots, originalSlots.value),
)

// Mirrored from GuardedSave so the inputs can disable themselves mid-save.
const saving = ref(false)

// --- Email verification code (sent to the NEW address to prove ownership) ---
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
// Client-side flow token, generated once on the client (same pattern as the
// registration page). Sent on both send-code and the final PATCH.
const emailCodeSession = useState<string>('email-change-session', () => '')
const emailCode = ref('')
const codeSentTo = ref<string | null>(null) // the address a code was last sent to
const sendingCode = ref(false)

const normalizedDraftEmail = computed(() => draft.value.email.trim().toLowerCase())
const emailWillChange = computed(
  () => !!normalizedDraftEmail.value && normalizedDraftEmail.value !== originalEmail.value,
)
const canSendCode = computed(
  () => emailWillChange.value && EMAIL_RE.test(normalizedDraftEmail.value) && !sendingCode.value,
)
const codeIsStale = computed(
  () => codeSentTo.value !== null && codeSentTo.value !== normalizedDraftEmail.value,
)

async function sendEmailCode(): Promise<void> {
  if (!canSendCode.value) return
  sendingCode.value = true
  try {
    await $fetch('/api/auth/me/email-code', {
      method: 'POST',
      body: { newEmail: normalizedDraftEmail.value, session: emailCodeSession.value },
    })
    codeSentTo.value = normalizedDraftEmail.value
    emailCode.value = ''
    toast.success(`Code sent to ${normalizedDraftEmail.value}`)
  } catch (e) {
    toast.error(messageFromError(e, 'Could not send code'))
  } finally {
    sendingCode.value = false
  }
}

async function onSave(): Promise<boolean> {
  if (draft.value.newPassword !== draft.value.confirm) {
    toast.error('New passwords do not match')
    return false
  }

  const body: Record<string, unknown> = {}

  // Email change — requires a code that was sent to (and still matches) the new
  // address. The server re-checks via consumeCode, so this is a UX guard.
  const wantEmail = normalizedDraftEmail.value
  if (wantEmail && wantEmail !== originalEmail.value) {
    if (!codeSentTo.value || codeSentTo.value !== wantEmail || !emailCode.value) {
      toast.error('Enter the verification code sent to your new email')
      return false
    }
    body.email = wantEmail
    body.code = emailCode.value
    body.session = emailCodeSession.value
  }

  if (draft.value.newPassword) {
    body.currentPassword = draft.value.currentPassword
    body.newPassword = draft.value.newPassword
  }
  if (draft.value.notifyExpiry !== originalNotify.value)
    body.notifyExpiry = draft.value.notifyExpiry
  if (draft.value.reminderTime !== originalTime.value) body.reminderTime = draft.value.reminderTime
  if (draft.value.tz !== originalTz.value) body.tz = draft.value.tz
  if (!slotsEqual(draft.value.reminderSlots, originalSlots.value))
    body.reminderSlots = draft.value.reminderSlots

  if (Object.keys(body).length === 0) return false

  try {
    const res = await $fetch<MeData>('/api/auth/me', { method: 'PATCH', body })
    originalEmail.value = res.user.email
    if (user.value) user.value.email = res.user.email
    originalNotify.value = res.notifyExpiry
    originalSlots.value = res.reminderSlots ?? [...SYSTEM_DEFAULT_SLOTS]
    originalTime.value = res.reminderTime ?? '12:00'
    originalTz.value = res.tz ?? null
    draft.value = {
      email: res.user.email,
      currentPassword: '',
      newPassword: '',
      confirm: '',
      notifyExpiry: res.notifyExpiry,
      reminderSlots: [...(res.reminderSlots ?? SYSTEM_DEFAULT_SLOTS)],
      reminderTime: res.reminderTime ?? '12:00',
      tz: res.tz ?? null,
    }
    emailCode.value = ''
    codeSentTo.value = null
    return true
  } catch (e) {
    toast.error(messageFromError(e, 'Failed to save'))
    return false
  }
}

function onDiscard(): void {
  draft.value = {
    email: originalEmail.value,
    currentPassword: '',
    newPassword: '',
    confirm: '',
    notifyExpiry: originalNotify.value,
    reminderSlots: [...originalSlots.value],
    reminderTime: originalTime.value,
    tz: originalTz.value,
  }
  emailCode.value = ''
  codeSentTo.value = null
}

// Reminder controls + timezone select read/write the draft only (no per-change
// write — everything goes through the Save bar).
const notifModel = computed(() => ({
  enabled: draft.value.notifyExpiry,
  slots: draft.value.reminderSlots,
  time: draft.value.reminderTime,
}))
function onNotifChange(val: { enabled: boolean; slots: ReminderSlot[]; time: string }): void {
  draft.value.notifyExpiry = val.enabled
  draft.value.reminderSlots = val.slots
  draft.value.reminderTime = val.time
}
function onTzChange(e: Event): void {
  draft.value.tz = (e.target as HTMLSelectElement).value || null
}
function autoDetectTz(): void {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  if (tz) draft.value.tz = tz
}

// --- Trusted browsers (all of the user's devices; revoke per entry) ---
interface TrustDevice {
  id: number
  name: string
  device: string
  current: boolean
  trustedUntil: string
  lastRefreshedAt: string
  revoked: boolean
}
const { data: trustData, refresh: refreshTrust } = await useFetch<{ devices: TrustDevice[] }>(
  '/api/auth/me/trust',
)
const revokingId = ref<number | null>(null)
const fmtDate = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString()
}
async function revokeDevice(id: number): Promise<void> {
  revokingId.value = id
  try {
    await $fetch(`/api/auth/me/trust/${id}`, { method: 'DELETE' })
    toast.success('Trusted browser revoked')
    await refreshTrust()
  } catch (e) {
    toast.error(messageFromError(e, 'Could not revoke'))
  } finally {
    revokingId.value = null
  }
}

// --- Passkeys (independent of the draft above) ---
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

onMounted(() => {
  loadPasskeys()
  if (!emailCodeSession.value) emailCodeSession.value = crypto.randomUUID()
})
</script>

<template>
  <div class="mx-auto w-full max-w-3xl space-y-8">
    <h1 class="text-xl font-semibold tracking-tight sm:text-2xl">Settings</h1>

    <!-- Notifications -->
    <Card>
      <CardHeader>
        <CardTitle class="text-base">Notifications</CardTitle>
        <CardDescription
          >Your default expiry-reminder schedule, in your own timezone. You can override it per page
          from that page's Notifications tab.</CardDescription
        >
      </CardHeader>
      <CardContent class="space-y-4">
        <ReminderControls
          :model-value="notifModel"
          :disabled="saving"
          @update:model-value="onNotifChange"
        />

        <div class="space-y-1.5 border-t pt-4">
          <Label for="settings-tz">Timezone</Label>
          <div class="flex items-center gap-2">
            <select
              id="settings-tz"
              class="h-9 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm"
              :value="draft.tz ?? ''"
              :disabled="saving"
              @change="onTzChange"
            >
              <option value="" disabled>Select a timezone…</option>
              <option v-for="tz in timezones ?? []" :key="tz" :value="tz">
                {{ tz.replaceAll('_', ' ') }}
              </option>
            </select>
            <Button variant="outline" size="sm" :disabled="saving" @click="autoDetectTz">
              Auto-detect
            </Button>
          </div>
          <p class="text-xs text-muted-foreground">
            Reminders fire at this timezone's wall-clock time.
          </p>
        </div>
      </CardContent>
    </Card>

    <!-- Email -->
    <Card>
      <CardHeader>
        <CardTitle class="text-base">Email</CardTitle>
        <CardDescription
          >Change the email associated with your account. A verification code is sent to the new
          address to confirm it.</CardDescription
        >
      </CardHeader>
      <CardContent class="space-y-3">
        <div class="flex flex-col gap-2">
          <Label for="settings-email">New email</Label>
          <Input id="settings-email" v-model="draft.email" type="email" :disabled="saving" />
        </div>
        <div class="flex flex-col gap-2">
          <Label for="settings-email-code">Verification code</Label>
          <div class="flex items-center gap-2">
            <Input
              id="settings-email-code"
              v-model="emailCode"
              inputmode="numeric"
              autocomplete="one-time-code"
              placeholder="6-digit code"
              class="flex-1"
              :disabled="saving"
            />
            <Button
              variant="outline"
              size="sm"
              :disabled="!canSendCode || saving"
              @click="sendEmailCode"
            >
              {{ sendingCode ? 'Sending…' : 'Send code' }}
            </Button>
          </div>
          <p v-if="codeSentTo && !codeIsStale" class="text-xs text-muted-foreground">
            Enter the 6-digit code sent to {{ codeSentTo }}.
          </p>
          <p v-else-if="codeIsStale" class="text-xs text-amber-600 dark:text-amber-400">
            You changed the email — resend the code.
          </p>
          <p v-else class="text-xs text-muted-foreground">
            Enter your new email, then click Send code.
          </p>
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

    <!-- Trusted browsers (per-device list, revoke per entry) -->
    <Card>
      <CardHeader>
        <CardTitle class="text-base">Trusted browsers</CardTitle>
        <CardDescription
          >Browsers that earned verification trust while you were signed in. Trust is device-bound
          and renews automatically while the browser keeps visiting — revoking signs that device out
          everywhere; re-verifying on it re-earns trust.</CardDescription
        >
      </CardHeader>
      <CardContent class="flex flex-col gap-2">
        <p v-if="!trustData?.devices.length" class="text-sm text-muted-foreground">
          No trusted browsers yet. Complete a verification on any page (signed in, with "trust this
          browser" checked) to list it here.
        </p>
        <div
          v-for="d in trustData?.devices ?? []"
          :key="d.id"
          class="flex items-center justify-between gap-3 rounded-md border p-3"
          :class="d.revoked ? 'opacity-60' : d.current ? 'border-primary/40 bg-primary/5' : ''"
        >
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2 text-sm">
              <span class="font-medium">{{ d.name }}</span>
              <span class="text-xs text-muted-foreground">{{ d.device }}</span>
              <span
                v-if="d.current"
                class="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary-foreground"
                >this browser</span
              >
              <span
                v-if="d.revoked"
                class="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                >revoked</span
              >
            </div>
            <p class="mt-1 text-xs text-muted-foreground">
              {{
                d.revoked
                  ? `Revoked · last visit ${fmtDate(d.lastRefreshedAt)}`
                  : `Trusted until ${fmtDate(d.trustedUntil)} · last visit ${fmtDate(d.lastRefreshedAt)}`
              }}
            </p>
          </div>
          <Button
            v-if="!d.revoked"
            variant="outline"
            size="sm"
            class="shrink-0"
            :disabled="revokingId === d.id"
            @click="revokeDevice(d.id)"
          >
            <Icon
              :spec="revokingId === d.id ? 'LoaderCircle' : 'ShieldOff'"
              :size="16"
              :class="revokingId === d.id ? 'animate-spin' : ''"
            />
            Revoke
          </Button>
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

    <!-- Save bar + leave guard + saving lifecycle (page owns the draft) -->
    <GuardedSave
      v-model:saving="saving"
      :dirty="isDirty"
      :on-save="onSave"
      :on-discard="onDiscard"
    />
  </div>
</template>
