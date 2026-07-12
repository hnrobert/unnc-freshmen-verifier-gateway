<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import siteConfig from '@config/site.config'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import Icon from '@/components/Icon.vue'
import StatusAlert from '@/components/StatusAlert.vue'
import { verify, type VerifyReason } from '@/lib/verify'
import { useVerifier } from '@/composables/useVerifier'

const { t } = useI18n()
const router = useRouter()
const { setVerified } = useVerifier()

const name = ref('')
const idNumber = ref('')
const submitting = ref(false)
const errorMsg = ref('')

const reasonKey: Record<VerifyReason, string> = {
  empty_name: 'errors.emptyName',
  bad_id_format: 'errors.badIdFormat',
  not_found: 'errors.notFound',
  ok: 'errors.generic',
}

async function onSubmit(): Promise<void> {
  errorMsg.value = ''
  submitting.value = true
  try {
    const result = await verify({ name: name.value, idNumber: idNumber.value })
    if (result.ok) {
      setVerified(true)
      await router.push({ name: 'welcome' })
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
  <DefaultLayout>
    <Card class="mx-auto mt-2 max-w-md">
      <CardHeader class="text-center">
        <CardTitle class="text-xl">{{ t('verify.heading') }}</CardTitle>
        <CardDescription>{{ t('verify.subheading') }}</CardDescription>
      </CardHeader>
      <CardContent>
        <form class="flex flex-col gap-4" @submit.prevent="onSubmit">
          <div class="flex flex-col gap-2">
            <Label for="vg-name">
              <Icon :spec="siteConfig.icons.nameField" :size="16" />
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
              <Icon :spec="siteConfig.icons.idField" :size="16" />
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

          <StatusAlert
            v-if="errorMsg"
            variant="error"
            :message="errorMsg"
            :icon="siteConfig.icons.error"
          />

          <Button type="submit" size="lg" :disabled="submitting" class="mt-1 w-full">
            <Icon
              v-if="submitting"
              :spec="siteConfig.icons.verifying"
              :size="18"
              class="animate-spin"
            />
            <Icon v-else :spec="siteConfig.icons.submit" :size="18" />
            {{ submitting ? t('verify.submitting') : t('verify.submit') }}
          </Button>
        </form>
      </CardContent>
    </Card>
  </DefaultLayout>
</template>
