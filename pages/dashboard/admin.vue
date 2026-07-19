<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: ['auth', 'superadmin'] })

interface UserRow {
  id: number
  email: string
  role: string
  createdAt: string
}
interface OrgRow {
  id: number
  slug: string
  name: string
  createdAt: string
  ownerEmail: string
}

const route = useRoute()
type AdminTab = 'orgs' | 'users' | 'registration' | 'mail'
const tab = computed({
  get: () =>
    ['users', 'registration', 'mail'].includes(route.query.tab as string)
      ? (route.query.tab as AdminTab)
      : 'orgs',
  set: (v) => navigateTo({ path: '/dashboard/admin', query: { tab: v } }),
})

const { data: users, refresh: refreshUsers } = await useFetch<UserRow[]>('/api/admin/users')
const { data: orgs } = await useFetch<OrgRow[]>('/api/admin/orgs')
const saving = ref<Record<number, boolean>>({})

async function onRoleChange(user: UserRow, role: string) {
  saving.value[user.id] = true
  try {
    await $fetch(`/api/admin/users/${user.id}`, { method: 'PATCH', body: { role } })
    user.role = role
    toast.success('Role updated')
  } catch (e) {
    toast.error(messageFromError(e, 'Update failed'))
    await refreshUsers()
  } finally {
    saving.value[user.id] = false
  }
}

// Registration email whitelist (superadmin-only).
interface WhitelistConfig {
  enabled: boolean
  patterns: string[]
}
const { data: whitelist } = await useFetch<WhitelistConfig>('/api/admin/registration')
const wlEnabled = ref(false)
const wlPatternsText = ref('')
const wlSaving = ref(false)
const wlSaved = ref(false)
// Snapshot of the persisted values, for dirty tracking + discard.
const wlOriginal = ref({ enabled: false, patternsText: '' })
watch(
  whitelist,
  (w) => {
    if (!w) return
    const snap = { enabled: w.enabled, patternsText: w.patterns.join('\n') }
    wlEnabled.value = snap.enabled
    wlPatternsText.value = snap.patternsText
    wlOriginal.value = snap
  },
  { immediate: true },
)
const wlDirty = computed(
  () =>
    wlEnabled.value !== wlOriginal.value.enabled ||
    wlPatternsText.value !== wlOriginal.value.patternsText,
)
// Unsaved-changes prompt on leave (registration whitelist).
const { confirmLeave, proceed } = useUnsavedLeaveGuard(wlDirty, wlSaving)
async function saveWhitelist() {
  wlSaving.value = true
  wlSaved.value = false
  try {
    const patterns = wlPatternsText.value
      .split('\n')
      .map((p) => p.trim())
      .filter(Boolean)
    const res = await $fetch<WhitelistConfig>('/api/admin/registration', {
      method: 'PUT',
      body: { enabled: wlEnabled.value, patterns },
    })
    const snap = { enabled: res.enabled, patternsText: res.patterns.join('\n') }
    wlEnabled.value = snap.enabled
    wlPatternsText.value = snap.patternsText
    wlOriginal.value = snap
    wlSaved.value = true
    setTimeout(() => (wlSaved.value = false), 2000)
  } catch (e) {
    toast.error(messageFromError(e, 'Save failed'))
  } finally {
    wlSaving.value = false
  }
}
function discardWhitelist() {
  wlEnabled.value = wlOriginal.value.enabled
  wlPatternsText.value = wlOriginal.value.patternsText
}

// Site mail/SMTP config (superadmin-owned site setting).
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
const { user: authUser } = useAuth()
const { data: mail } = await useFetch<MailConfigView>('/api/mail/config')
const mailPassword = ref('')
const mailSaving = ref(false)
const mailTesting = ref(false)
const testRecipient = ref(authUser.value?.email ?? '')

async function onSaveMail() {
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
async function onSendTest() {
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
</script>

<template>
  <div>
    <h1 class="text-xl font-semibold tracking-tight sm:text-2xl">
      {{
        tab === 'users'
          ? 'Users'
          : tab === 'registration'
            ? 'Registration'
            : tab === 'mail'
              ? 'Mail (SMTP)'
              : 'All Organizations'
      }}
    </h1>

    <!-- Orgs tab -->
    <div v-if="tab === 'orgs'" class="mt-6 space-y-3">
      <Card v-for="org in orgs" :key="org.id">
        <CardContent>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="min-w-0">
              <div class="font-medium">{{ org.name }}</div>
              <div class="text-xs text-muted-foreground">
                /{{ org.slug }} · {{ org.ownerEmail }}
              </div>
            </div>
            <div class="flex gap-2">
              <Button size="sm" variant="outline" @click="navigateTo(`/dashboard/${org.slug}/edit`)"
                >Edit</Button
              >
              <a
                :href="`/${org.slug}/preview`"
                target="_blank"
                class="inline-flex h-9 items-center rounded-md px-3 text-xs font-medium border hover:bg-accent"
                >Preview ↗</a
              >
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Users tab -->
    <div v-else-if="tab === 'users'" class="mt-6">
      <Card class="hidden sm:block">
        <CardContent>
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b text-left text-muted-foreground">
                <th class="py-3 font-medium">ID</th>
                <th class="py-3 font-medium">Email</th>
                <th class="py-3 font-medium">Role</th>
                <th class="py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="u in users" :key="u.id" class="border-b last:border-0">
                <td class="py-3 text-muted-foreground">{{ u.id }}</td>
                <td class="py-3 font-medium">{{ u.email }}</td>
                <td class="py-3">
                  <select
                    :value="u.role"
                    :disabled="saving[u.id]"
                    class="h-9 rounded-md border bg-transparent px-2 text-sm"
                    @change="onRoleChange(u, ($event.target as HTMLSelectElement).value)"
                  >
                    <option value="admin">admin</option>
                    <option value="superadmin">superadmin</option>
                  </select>
                </td>
                <td class="py-3 text-muted-foreground">
                  {{ new Date(u.createdAt).toLocaleDateString() }}
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
      <div class="space-y-3 sm:hidden">
        <Card v-for="u in users" :key="u.id">
          <CardContent>
            <div class="flex items-center justify-between gap-2">
              <div class="min-w-0">
                <div class="truncate font-medium">{{ u.email }}</div>
                <div class="text-xs text-muted-foreground">ID {{ u.id }}</div>
              </div>
              <select
                :value="u.role"
                :disabled="saving[u.id]"
                class="h-9 shrink-0 rounded-md border bg-transparent px-2 text-xs"
                @change="onRoleChange(u, ($event.target as HTMLSelectElement).value)"
              >
                <option value="admin">admin</option>
                <option value="superadmin">superadmin</option>
              </select>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>

    <!-- Registration email whitelist tab -->
    <div v-else-if="tab === 'registration'" class="mt-6 space-y-4 pb-24">
      <Card>
        <CardContent class="space-y-4">
          <div class="flex items-start gap-3">
            <input
              id="wl-enabled"
              v-model="wlEnabled"
              type="checkbox"
              class="mt-0.5 size-4 rounded border"
            />
            <div>
              <Label for="wl-enabled" class="cursor-pointer font-medium"
                >Restrict registration by email</Label
              >
              <p class="text-xs text-muted-foreground">
                When on, only emails matching a pattern below can register. Off = open registration
                (current default).
              </p>
            </div>
          </div>
          <div class="space-y-1.5">
            <Label for="wl-patterns">Allowed email patterns (glob, one per line)</Label>
            <textarea
              id="wl-patterns"
              v-model="wlPatternsText"
              rows="8"
              spellcheck="false"
              class="w-full rounded-md border bg-transparent p-3 font-mono text-sm"
              placeholder="*@nottingham.edu.cn&#10;*@*.nottingham.edu.cn&#10;{john,jane}@example.com"
            ></textarea>
            <p class="text-xs text-muted-foreground">
              Glob: <code>*</code> any chars, <code>?</code> one char,
              <code>{a,b}</code> alternation. Case-insensitive. The first registration (superadmin
              bootstrap) is always allowed.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Mail (site-wide SMTP) tab -->
    <div v-else-if="tab === 'mail'" class="mt-6">
      <Card v-if="mail">
        <CardHeader>
          <CardTitle class="text-base">Mail (SMTP)</CardTitle>
          <CardDescription>
            Site-wide outgoing mail settings — every email the gateway sends uses this SMTP + sender
            configuration.
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
    </div>

    <!-- Sticky save/discard bar (registration whitelist only) -->
    <SaveBar
      v-if="tab === 'registration'"
      :dirty="wlDirty"
      :saving="wlSaving"
      :saved="wlSaved"
      @save="saveWhitelist"
      @discard="discardWhitelist"
    />

    <!-- Unsaved changes leave dialog (registration whitelist) -->
    <UnsavedLeaveDialog
      :open="confirmLeave"
      :saving="wlSaving"
      @stay="confirmLeave = false"
      @discard="
        () => {
          discardWhitelist()
          proceed()
        }
      "
      @save="
        async () => {
          await saveWhitelist()
          proceed()
        }
      "
    />
  </div>
</template>
