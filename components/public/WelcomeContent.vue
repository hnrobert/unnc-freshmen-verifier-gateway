<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { AdmissionResult, Locale } from '#shared/types'

const props = defineProps<{ stubAdmission?: AdmissionResult }>()
const route = useRoute()
const slug = computed(() => route.params.slug as string)
const { config } = useOrgConfig()
const { t, locale } = useI18n()
const router = useRouter()
const { reset, admission } = useVerifier()

// Raw markdown body for the active locale (avoid vue-i18n `{` interpolation).
const body = computed(() => {
  const messages = config.value.messages[locale.value as Locale] as
    | { welcome?: { body?: string } }
    | undefined
  return messages?.welcome?.body ?? ''
})
const image = computed(() => config.value.welcome.image)
const imageMaxWidth = computed(() => config.value.welcome.imageMaxWidth ?? '12rem')
const imageRadius = computed(() => config.value.welcome.imageRadius ?? '0.5rem')

const details = computed(() => {
  const a = props.stubAdmission ?? admission.value
  if (!a || !a.admitted) return null
  const rows: { label: string; value: string }[] = []
  if (a.name) rows.push({ label: t('admission.name'), value: a.name })
  if (a.university) rows.push({ label: t('admission.university'), value: a.university })
  if (a.date) rows.push({ label: t('admission.date'), value: a.date })
  if (a.detail && a.detail !== a.message) rows.push({ label: t('admission.detail'), value: a.detail })
  return rows.length ? rows : null
})

function goBack(): void {
  if (props.stubAdmission) return // preview — no navigation
  reset()
  const isDemo = useRoute().path.includes('/demo/')
  void router.push(isDemo ? `/${slug.value}/demo` : `/${slug.value}`)
}
</script>

<template>
  <div class="mx-auto mt-2 flex max-w-md flex-col items-center text-center">
    <span
      v-if="image"
      class="mb-6 flex w-full items-center justify-center"
      :style="{ maxWidth: imageMaxWidth }"
    >
      <img
        :src="image"
        :alt="t('welcome.imageAlt')"
        class="w-full shadow-sm"
        :style="{ borderRadius: imageRadius }"
      />
    </span>

    <span class="mb-3 inline-flex items-center gap-1.5 rounded-full border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
      <Icon :spec="config.icons.success" :size="14" />
      {{ t('welcome.badge') }}
    </span>

    <h1 class="flex items-center justify-center gap-2 text-3xl font-semibold tracking-tight">
      <Icon :spec="config.icons.welcome" :size="28" />
      <span>{{ t('welcome.title') }}</span>
    </h1>

    <Card v-if="details" class="mt-6 w-full text-left">
      <CardHeader>
        <CardTitle class="text-base">{{ t('admission.title') }}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl class="grid grid-cols-1 gap-2 text-sm">
          <div v-for="row in details" :key="row.label" class="flex justify-between gap-4">
            <dt class="text-muted-foreground">{{ row.label }}</dt>
            <dd class="text-right font-medium">{{ row.value }}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>

    <div class="mt-6 w-full text-left">
      <MarkdownView :source="body" />
    </div>

    <Button v-if="!props.stubAdmission" variant="outline" class="mt-8" @click="goBack">
      <Icon :spec="config.icons.back" :size="16" />
      {{ t('welcome.back') }}
    </Button>
  </div>
</template>
