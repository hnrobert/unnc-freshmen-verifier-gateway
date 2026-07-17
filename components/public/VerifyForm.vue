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

const name = ref(props.defaultName ?? '')
const idNumber = ref(props.defaultId ?? '')
const submitting = ref(false)
const errorMsg = ref('')

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
  if (props.preview) return // visual-only
  errorMsg.value = ''
  const dest = props.welcomePath ?? `/${props.slug}/welcome`
  // Preview mode: skip the real portal check and jump straight to the welcome page.
  if (props.preview) {
    setVerified(true, { ok: true, admitted: true, message: 'preview', name: name.value || '示例姓名' })
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
    errorMsg.value = t(reasonKey[result.reason] ?? 'errors.generic')
  } catch {
    errorMsg.value = t('errors.generic')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Card class="mx-auto mt-2 max-w-md">
    <CardHeader class="text-center">
      <CardTitle class="text-xl">{{ t('verify.heading') }}</CardTitle>
      <CardDescription>{{ t('verify.subheading') }}</CardDescription>
    </CardHeader>
    <CardContent>
      <form class="flex flex-col gap-4" @submit.prevent="onSubmit">
        <div class="flex flex-col gap-2">
          <Label for="vg-name">
            <Icon :spec="config.icons.nameField" :size="16" />
            {{ t('verify.nameLabel') }}
          </Label>
          <Input id="vg-name" v-model="name" :placeholder="t('verify.namePlaceholder')" autocomplete="name" :disabled="submitting" />
        </div>
        <div class="flex flex-col gap-2">
          <Label for="vg-id">
            <Icon :spec="config.icons.idField" :size="16" />
            {{ t('verify.idLabel') }}
          </Label>
          <Input id="vg-id" v-model="idNumber" :placeholder="t('verify.idPlaceholder')" autocomplete="off" inputmode="text" maxlength="18" :disabled="submitting" />
        </div>
        <StatusAlert v-if="errorMsg" variant="error" :message="errorMsg" :icon="config.icons.error" />
        <Button type="submit" size="lg" :disabled="submitting || props.preview" class="mt-1 w-full">
          <Icon v-if="submitting" :spec="config.icons.verifying" :size="18" class="animate-spin" />
          <Icon v-else :spec="config.icons.submit" :size="18" />
          {{ submitting ? t('verify.submitting') : t('verify.submit') }}
        </Button>
        <p class="text-center text-xs leading-relaxed text-muted-foreground">{{ t('verify.hint') }}</p>
      </form>
    </CardContent>
  </Card>
</template>
