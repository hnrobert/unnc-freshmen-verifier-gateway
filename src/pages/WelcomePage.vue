<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import siteConfig from '@config/site.config'
import { siteMessages } from '@/i18n'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import { Button } from '@/components/ui/button'
import Icon from '@/components/Icon.vue'
import MarkdownView from '@/components/MarkdownView.vue'
import { useVerifier } from '@/composables/useVerifier'
import type { Locale } from '@/shared/types'

const { t, locale } = useI18n()
const router = useRouter()
const { reset } = useVerifier()

// Read the raw markdown body for the active locale directly from messages so
// `{` characters in the markdown never trip vue-i18n's interpolation.
const body = computed(() => {
  const messages = siteMessages[locale.value as Locale] as
    | { welcome?: { body?: string } }
    | undefined
  return messages?.welcome?.body ?? ''
})

const image = siteConfig.welcome.image
const imageMaxWidth = siteConfig.welcome.imageMaxWidth ?? '12rem'
const imageRounded = siteConfig.welcome.imageRounded ?? false

function goBack(): void {
  reset()
  void router.push({ name: 'verify' })
}
</script>

<template>
  <DefaultLayout>
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
          :class="imageRounded ? 'rounded-full' : 'rounded-2xl'"
        />
      </span>

      <span
        class="mb-3 inline-flex items-center gap-1.5 rounded-full border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground"
      >
        <Icon :spec="siteConfig.icons.success" :size="14" />
        {{ t('welcome.badge') }}
      </span>

      <h1 class="flex items-center justify-center gap-2 text-3xl font-semibold tracking-tight">
        <Icon :spec="siteConfig.icons.welcome" :size="28" />
        <span>{{ t('welcome.title') }}</span>
      </h1>

      <div class="mt-6 w-full text-left">
        <MarkdownView :source="body" />
      </div>

      <Button variant="outline" class="mt-8" @click="goBack">
        <Icon :spec="siteConfig.icons.back" :size="16" />
        {{ t('welcome.back') }}
      </Button>
    </div>
  </DefaultLayout>
</template>
