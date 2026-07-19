<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: ['auth', 'superadmin'] })

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
const { data: mailData } = await useFetch<MailConfigView | null>('/api/mail/config')

const DEFAULT_MAIL: MailConfigView = {
  smtpServer: '',
  smtpPort: 587,
  useSsl: false,
  useTls: true,
  usePassword: true,
  senderEmail: '',
  senderEmailDisplay: '',
  senderDomain: '',
  hasPassword: false,
  maxLenRecipientEmail: 64,
  maxLenSubject: 255,
  maxLenBody: 50000,
}
// Defaulted local form model — the card always shows (even before any config
// exists), populated from the fetch when one comes back.
const mail = ref<MailConfigView>({ ...DEFAULT_MAIL })
// Snapshot of persisted values, for dirty tracking + discard.
const mailOriginal = ref<MailConfigView>({ ...DEFAULT_MAIL })
watch(
  mailData,
  (m) => {
    const v = m ? { ...m } : { ...DEFAULT_MAIL }
    mail.value = { ...v }
    mailOriginal.value = { ...v }
  },
  { immediate: true },
)
const mailPassword = ref('')
const mailSaving = ref(false)
const mailSaved = ref(false)
const mailTesting = ref(false)
const testRecipient = ref(authUser.value?.email ?? '')
const mailDirty = computed(
  () =>
    JSON.stringify(mail.value) !== JSON.stringify(mailOriginal.value) || mailPassword.value !== '',
)
const { confirmLeave, proceed } = useUnsavedLeaveGuard(mailDirty, mailSaving)

async function onSaveMail() {
  mailSaving.value = true
  mailSaved.value = false
  try {
    const res = await $fetch<MailConfigView>('/api/mail/config', {
      method: 'PUT',
      body: { ...mail.value, senderPassword: mailPassword.value },
    })
    mail.value = { ...res }
    mailOriginal.value = { ...res }
    mailPassword.value = ''
    mailSaved.value = true
    setTimeout(() => (mailSaved.value = false), 2000)
  } catch (e) {
    toast.error(messageFromError(e, 'Save failed'))
  } finally {
    mailSaving.value = false
  }
}
function discardMail() {
  mail.value = { ...mailOriginal.value }
  mailPassword.value = ''
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
    <h1 class="text-xl font-semibold tracking-tight sm:text-2xl">Mail (SMTP)</h1>
    <div class="mt-6 pb-24">
      <Card>
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

    <SaveBar
      :dirty="mailDirty"
      :saving="mailSaving"
      :saved="mailSaved"
      @save="onSaveMail"
      @discard="discardMail"
    />
    <UnsavedLeaveDialog
      :open="confirmLeave"
      :saving="mailSaving"
      @stay="confirmLeave = false"
      @discard="
        () => {
          discardMail()
          proceed()
        }
      "
      @save="
        async () => {
          await onSaveMail()
          proceed()
        }
      "
    />
  </div>
</template>
