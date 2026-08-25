<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { verify, type VerifyReason } from '~/lib/verify'

const props = defineProps<{
  slug: string
  preview?: boolean
  defaultName?: string
  defaultId?: string
  welcomePath?: string
}>()
const { config } = usePageConfig()
const { t, locale } = useI18n()
const router = useRouter()
const { setVerified } = useVerifier()

// Site-wide gateway switches (admin panel → Verification): whether the
// freshman tab exists at all, and whether the email tab mails welcome content
// or runs an email+code flow. Preview keeps both tabs visible regardless.
const { data: gateways } = await useFetch<{
  freshmanEnabled: boolean
  emailMode: 'welcome' | 'code'
}>(() => `/api/pages/${props.slug}/gateways-status`, { watch: [() => props.slug] })
const showVerifyTab = computed(() => props.preview || (gateways.value?.freshmanEnabled ?? true))
const emailMode = computed(() =>
  props.preview ? 'welcome' : (gateways.value?.emailMode ?? 'welcome'),
)

const tab = ref<'verify' | 'email'>('verify')
// When the freshman tab is switched off, land on the email tab.
watchEffect(() => {
  if (!showVerifyTab.value && tab.value === 'verify') tab.value = 'email'
})

const name = ref(props.defaultName ?? '')
const idNumber = ref(props.defaultId ?? '')
const submitting = ref(false)

const reasonKey: Record<VerifyReason, string> = {
  empty_name: 'errors.emptyName',
  bad_id_format: 'errors.badIdFormat',
  not_admitted: 'errors.notAdmitted',
  captcha: 'errors.captcha',
  network: 'errors.network',
  generic: 'errors.generic',
  ok: 'errors.generic',
}

async function onSubmit(): Promise<void> {
  const dest = props.welcomePath ?? `/${props.slug}/welcome`
  if (props.preview) {
    setVerified(true, {
      ok: true,
      admitted: true,
      message: 'preview',
      name: name.value || '示例姓名',
    })
    await router.push(dest)
    return
  }
  submitting.value = true
  try {
    const result = await verify(props.slug, config.value.gateway, {
      name: name.value,
      idNumber: idNumber.value,
    })
    if (result.ok) {
      setVerified(true, result.admission)
      await router.push(dest)
      return
    }
    toast.error(t(reasonKey[result.reason] ?? 'errors.generic'))
  } catch {
    toast.error(t('errors.generic'))
  } finally {
    submitting.value = false
  }
}

const emailAddr = ref('')
const emailSending = ref(false)

const emailValid = computed(() =>
  emailAddr.value.trim().toLowerCase().endsWith('@nottingham.edu.cn'),
)

async function onSendEmail(): Promise<void> {
  if (!emailValid.value) return
  emailSending.value = true
  try {
    const res = await $fetch<{ warning?: string }>(`/api/pages/${props.slug}/email-page`, {
      method: 'POST',
      // Send in the locale the visitor currently has selected, so the email
      // content (brand/welcome/footer) matches their page language.
      body: { email: emailAddr.value.trim().toLowerCase(), locale: locale.value },
    })
    toast.success(t('verify.emailSent'))
    if (res.warning) toast.warning(res.warning)
    emailAddr.value = ''
  } catch (e) {
    toast.error(messageFromError(e, t('errors.generic')))
  } finally {
    emailSending.value = false
  }
}

// --- Code mode: email + 6-digit code, grants a 30-day trusted cookie ---
const codeSession = useState<string>('vg.email-code-session', () => '')
const emailCode = ref('')
const codeSent = ref(false)
const codeSending = ref(false)
const codeVerifying = ref(false)

async function onSendCode(): Promise<void> {
  if (!emailValid.value) return
  if (!codeSession.value) codeSession.value = crypto.randomUUID()
  codeSending.value = true
  try {
    const res = await $fetch<{ warning?: string }>(`/api/pages/${props.slug}/email-code/send`, {
      method: 'POST',
      body: { email: emailAddr.value.trim().toLowerCase(), session: codeSession.value },
    })
    codeSent.value = true
    toast.success(t('verify.codeSent'))
    if (res.warning) toast.warning(res.warning)
  } catch (e) {
    toast.error(messageFromError(e, t('errors.generic')))
  } finally {
    codeSending.value = false
  }
}

async function onVerifyCode(): Promise<void> {
  codeVerifying.value = true
  try {
    const result = await $fetch<{
      ok: boolean
      admitted: boolean | null
      message: string
      name?: string
    }>(`/api/pages/${props.slug}/email-code/verify`, {
      method: 'POST',
      body: {
        email: emailAddr.value.trim().toLowerCase(),
        session: codeSession.value,
        code: emailCode.value.trim(),
      },
    })
    // Success walks straight into the welcome page — the server has set the
    // 30-day trusted-visitor cookie.
    setVerified(true, result)
    await router.push(props.welcomePath ?? `/${props.slug}/welcome`)
  } catch (e) {
    toast.error(messageFromError(e, t('verify.codeInvalid')))
  } finally {
    codeVerifying.value = false
  }
}
</script>

<template>
  <Card class="mx-auto mt-2 max-w-md gap-0">
    <CardHeader class="text-center">
      <CardTitle class="text-xl">{{ t('verify.heading') }}</CardTitle>
      <CardDescription>{{ t('verify.subheading') }}</CardDescription>
    </CardHeader>

    <!-- Switch (SMTP/POST style) — freshman tab hidden when disabled site-wide -->
    <div v-if="showVerifyTab" class="mx-6 mt-6 flex gap-1 rounded-md border p-1">
      <button
        class="flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors"
        :class="
          tab === 'verify'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent'
        "
        @click="tab = 'verify'"
      >
        <Icon :spec="config.icons.nameField" :size="14" />
        {{ t('verify.tabVerify') }}
      </button>
      <button
        class="flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors"
        :class="
          tab === 'email'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent'
        "
        @click="tab = 'email'"
      >
        <Icon spec="Mail" :size="14" />
        {{ t('verify.tabEmail') }}
      </button>
    </div>

    <CardContent :class="showVerifyTab ? 'pt-6' : 'pt-6 px-6 pb-6'">
      <!-- Tab 1: Verify form -->
      <form
        v-if="tab === 'verify' && showVerifyTab"
        class="flex flex-col gap-4"
        @submit.prevent="onSubmit"
      >
        <div class="flex flex-col gap-2">
          <Label for="vg-name">
            <Icon :spec="config.icons.nameField" :size="16" />
            {{ t('verify.nameLabel') }}
          </Label>
          <Input
            id="vg-name"
            v-model="name"
            :placeholder="t('verify.namePlaceholder')"
            autocomplete="name"
            :disabled="submitting"
          />
        </div>
        <div class="flex flex-col gap-2">
          <Label for="vg-id">
            <Icon :spec="config.icons.idField" :size="16" />
            {{ t('verify.idLabel') }}
          </Label>
          <Input
            id="vg-id"
            v-model="idNumber"
            :placeholder="t('verify.idPlaceholder')"
            autocomplete="off"
            inputmode="text"
            maxlength="18"
            :disabled="submitting"
          />
        </div>
        <Button type="submit" size="lg" :disabled="submitting" class="mt-1 w-full">
          <Icon v-if="submitting" :spec="config.icons.verifying" :size="18" class="animate-spin" />
          <Icon v-else :spec="config.icons.submit" :size="18" />
          {{ submitting ? t('verify.submitting') : t('verify.submit') }}
        </Button>
        <p class="text-center text-xs leading-relaxed text-muted-foreground">
          {{ t('verify.hint') }}
        </p>
      </form>

      <!-- Tab 2a: Email → mail welcome content (legacy mode) -->
      <form
        v-else-if="emailMode === 'welcome'"
        class="flex flex-col gap-4"
        @submit.prevent="onSendEmail"
      >
        <div class="flex flex-col gap-2">
          <Label for="vg-email">
            <Icon spec="Mail" :size="16" />
            {{ t('verify.emailLabel') }}
          </Label>
          <Input
            id="vg-email"
            v-model="emailAddr"
            type="email"
            :placeholder="t('verify.emailPlaceholder')"
            autocomplete="email"
            :disabled="emailSending"
          />
          <p v-if="emailAddr && !emailValid" class="text-xs text-red-500">
            {{ t('verify.emailInvalid') }}
          </p>
        </div>
        <Button type="submit" size="lg" :disabled="emailSending || !emailValid" class="mt-1 w-full">
          <Icon v-if="!emailSending" spec="Send" :size="18" />
          {{ emailSending ? t('verify.emailSubmitting') : t('verify.emailSubmit') }}
        </Button>
        <p class="text-center text-xs leading-relaxed text-muted-foreground">
          {{ t('verify.emailHint') }}
        </p>
      </form>

      <!-- Tab 2b: Email + verification code (30-day trusted cookie) -->
      <form v-else class="flex flex-col gap-4" @submit.prevent="onVerifyCode">
        <div class="flex flex-col gap-2">
          <Label for="vg-email-code">
            <Icon spec="Mail" :size="16" />
            {{ t('verify.emailLabel') }}
          </Label>
          <div class="flex gap-2">
            <Input
              id="vg-email-code"
              v-model="emailAddr"
              type="email"
              :placeholder="t('verify.emailPlaceholder')"
              autocomplete="email"
              :disabled="codeSending || codeVerifying"
            />
            <Button
              type="button"
              variant="outline"
              :disabled="!emailValid || codeSending || codeVerifying"
              @click="onSendCode"
            >
              <Icon v-if="codeSending" spec="LoaderCircle" :size="16" class="animate-spin" />
              <Icon v-else spec="Send" :size="16" />
              {{ t('verify.codeSend') }}
            </Button>
          </div>
          <p v-if="emailAddr && !emailValid" class="text-xs text-red-500">
            {{ t('verify.emailInvalid') }}
          </p>
        </div>

        <div v-if="codeSent" class="flex flex-col gap-2">
          <Label for="vg-code">
            <Icon spec="Key" :size="16" />
            {{ t('verify.codeLabel') }}
          </Label>
          <Input
            id="vg-code"
            v-model="emailCode"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="6"
            :placeholder="t('verify.codePlaceholder')"
            :disabled="codeVerifying"
          />
        </div>

        <Button
          v-if="codeSent"
          type="submit"
          size="lg"
          :disabled="codeVerifying || !/^\d{6}$/.test(emailCode.trim())"
          class="mt-1 w-full"
        >
          <Icon v-if="codeVerifying" spec="LoaderCircle" :size="18" class="animate-spin" />
          <Icon v-else :spec="config.icons.submit" :size="18" />
          {{ t('verify.codeSubmit') }}
        </Button>
        <p class="text-center text-xs leading-relaxed text-muted-foreground">
          {{ t('verify.codeHint') }}
        </p>
      </form>
    </CardContent>
  </Card>
</template>
