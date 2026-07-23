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
const { config } = useOrgConfig()
const { t } = useI18n()
const router = useRouter()
const { setVerified } = useVerifier()

// --- Tab state ---
const tab = ref<'verify' | 'email'>('verify')

// --- Verify form (existing) ---
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
  // Preview mode: skip the real portal check and jump straight to the welcome page.
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

// --- Email form (new) ---
const emailAddr = ref('')
const emailSending = ref(false)
const emailSent = ref(false)

const emailValid = computed(() =>
  emailAddr.value.trim().toLowerCase().endsWith('@nottingham.edu.cn'),
)

async function onSendEmail(): Promise<void> {
  if (!emailValid.value) return
  emailSending.value = true
  emailSent.value = false
  try {
    await $fetch(`/api/orgs/${props.slug}/email-page`, {
      method: 'POST',
      body: { email: emailAddr.value.trim().toLowerCase() },
    })
    emailSent.value = true
    toast.success('Page sent to your email')
  } catch {
    toast.error('Failed to send email')
  } finally {
    emailSending.value = false
  }
}
</script>

<template>
  <Card class="mx-auto mt-2 max-w-md">
    <CardHeader class="text-center">
      <CardTitle class="text-xl">{{ t('verify.heading') }}</CardTitle>
      <CardDescription>{{ t('verify.subheading') }}</CardDescription>
    </CardHeader>

    <!-- Tabs -->
    <div class="mx-6 flex gap-1 border-b">
      <button
        class="-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors"
        :class="
          tab === 'verify'
            ? 'border-primary text-foreground'
            : 'border-transparent text-muted-foreground hover:text-foreground'
        "
        @click="tab = 'verify'"
      >
        新生验证
      </button>
      <button
        class="-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors"
        :class="
          tab === 'email'
            ? 'border-primary text-foreground'
            : 'border-transparent text-muted-foreground hover:text-foreground'
        "
        @click="tab = 'email'"
      >
        邮箱验证
      </button>
    </div>

    <CardContent class="pt-6">
      <!-- Tab 1: Verify form (existing) -->
      <form v-if="tab === 'verify'" class="flex flex-col gap-4" @submit.prevent="onSubmit">
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

      <!-- Tab 2: Email form (new) -->
      <form v-else class="flex flex-col gap-4" @submit.prevent="onSendEmail">
        <div class="flex flex-col gap-2">
          <Label for="vg-email">
            <Icon spec="Mail" :size="16" />
            UNNC 邮箱
          </Label>
          <Input
            id="vg-email"
            v-model="emailAddr"
            type="email"
            placeholder="you@nottingham.edu.cn"
            autocomplete="email"
            :disabled="emailSending"
          />
          <p v-if="emailAddr && !emailValid" class="text-xs text-red-500">
            仅支持 @nottingham.edu.cn 邮箱
          </p>
        </div>
        <Button type="submit" size="lg" :disabled="emailSending || !emailValid" class="mt-1 w-full">
          <Icon spec="Send" :size="18" />
          {{ emailSending ? '发送中…' : '发送页面到邮箱' }}
        </Button>
        <div
          v-if="emailSent"
          class="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-center text-sm text-emerald-600"
        >
          ✓ 页面已发送到 {{ emailAddr }}
        </div>
        <p class="text-center text-xs leading-relaxed text-muted-foreground">
          输入你的 UNNC 邮箱，我们将把本页面的完整内容发送到你的邮箱。
        </p>
      </form>
    </CardContent>
  </Card>
</template>
