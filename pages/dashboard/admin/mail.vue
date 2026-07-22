<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: ['auth', 'superadmin'] })

interface MailConfigView {
  provider: string
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
  postUrl: string
  postSchema: string
  hasPostAuthToken: boolean
}
const { user: authUser } = useAuth()
const { data: mailData } = await useFetch<MailConfigView | null>('/api/mail/config')

const DEFAULT_MAIL: MailConfigView = {
  provider: 'smtp',
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
  postUrl: '',
  postSchema: 'smtogo',
  hasPostAuthToken: false,
}
const mail = ref<MailConfigView>({ ...DEFAULT_MAIL })
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
const postAuthToken = ref('')
const mailSaving = ref(false)
const mailSaved = ref(false)
const mailTesting = ref(false)
const testRecipient = ref(authUser.value?.email ?? '')
const mailDirty = computed(
  () =>
    JSON.stringify(mail.value) !== JSON.stringify(mailOriginal.value) ||
    mailPassword.value !== '' ||
    postAuthToken.value !== '',
)
const canTest = computed(() =>
  mail.value.provider === 'post'
    ? !!mail.value.postUrl
    : !!mail.value.smtpServer && (mail.value.hasPassword || mailPassword.value !== ''),
)
const { confirmLeave, proceed } = useUnsavedLeaveGuard(mailDirty, mailSaving)

async function onSaveMail() {
  mailSaving.value = true
  mailSaved.value = false
  try {
    const res = await $fetch<MailConfigView>('/api/mail/config', {
      method: 'PUT',
      body: {
        ...mail.value,
        senderPassword: mailPassword.value,
        postAuthToken: postAuthToken.value,
      },
    })
    mail.value = { ...res }
    mailOriginal.value = { ...res }
    mailPassword.value = ''
    postAuthToken.value = ''
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
  postAuthToken.value = ''
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
    <h1 class="text-xl font-semibold tracking-tight sm:text-2xl">Mail</h1>
    <div class="mt-6 pb-24">
      <Card>
        <CardHeader>
          <CardTitle class="text-base">Outgoing mail</CardTitle>
          <CardDescription>
            Site-wide mail configuration. Choose SMTP (direct) or POST (webhook to a smtogo / Power
            Automate endpoint).
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <!-- Provider selector -->
          <div class="flex gap-1 rounded-md border p-1">
            <button
              class="flex-1 rounded px-3 py-1.5 text-sm font-medium"
              :class="
                mail.provider === 'smtp'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent'
              "
              @click="mail.provider = 'smtp'"
            >
              SMTP
            </button>
            <button
              class="flex-1 rounded px-3 py-1.5 text-sm font-medium"
              :class="
                mail.provider === 'post'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent'
              "
              @click="mail.provider = 'post'"
            >
              POST webhook
            </button>
          </div>

          <!-- SMTP section -->
          <template v-if="mail.provider === 'smtp'">
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
                <Label for="mail-domain">Sender domain (Message-ID)</Label>
                <Input
                  id="mail-domain"
                  v-model="mail.senderDomain"
                  placeholder="example.com"
                  :disabled="mailSaving"
                />
              </div>
              <div class="flex flex-col gap-2">
                <Label for="mail-pass">SMTP password</Label>
                <Input
                  id="mail-pass"
                  v-model="mailPassword"
                  type="password"
                  :placeholder="mail.hasPassword ? '(unchanged)' : ''"
                  autocomplete="new-password"
                  :disabled="mailSaving || !mail.usePassword"
                />
              </div>
            </div>
          </template>

          <!-- POST webhook section -->
          <template v-if="mail.provider === 'post'">
            <div class="flex flex-col gap-2">
              <Label for="mail-post-url">Webhook URL</Label>
              <Input
                id="mail-post-url"
                v-model="mail.postUrl"
                placeholder="https://..."
                :disabled="mailSaving"
              />
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="flex flex-col gap-2">
                <Label for="mail-post-schema">Payload schema</Label>
                <select
                  id="mail-post-schema"
                  v-model="mail.postSchema"
                  class="h-9 rounded-md border bg-transparent px-2 text-sm"
                  :disabled="mailSaving"
                >
                  <option value="smtogo">smtogo ({ from, to, subject, html })</option>
                  <option value="powerautomate">
                    Power Automate ({ email, content, subject })
                  </option>
                </select>
              </div>
              <div class="flex flex-col gap-2">
                <Label for="mail-post-token">Bearer token (optional)</Label>
                <Input
                  id="mail-post-token"
                  v-model="postAuthToken"
                  type="password"
                  :placeholder="mail.hasPostAuthToken ? '(unchanged)' : ''"
                  autocomplete="new-password"
                  :disabled="mailSaving"
                />
              </div>
            </div>
          </template>

          <!-- Sender email (SMTP auth + From; smtogo POST uses 'from'. Not needed for Power Automate.) -->
          <div
            v-if="mail.provider === 'smtp' || mail.postSchema === 'smtogo'"
            class="grid gap-4 sm:grid-cols-2"
          >
            <div class="flex flex-col gap-2">
              <Label for="mail-from">Sender email</Label>
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
          </div>

          <!-- Test -->
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
              :disabled="mailTesting || !canTest"
              @click="onSendTest"
            >
              {{ mailTesting ? 'Sending…' : 'Send test' }}
            </Button>
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
