<script setup lang="ts">
import siteConfig from '@config/site.config'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/Icon.vue'

const { t } = useI18n()
</script>

<template>
  <div class="flex min-w-0 items-center gap-3">
    <span
      class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm"
    >
      <Icon :spec="siteConfig.icons.brand" :size="22" />
    </span>
    <div class="min-w-0">
      <div class="truncate text-sm font-semibold leading-tight sm:text-base">
        {{ t('brand.title') }}
      </div>
      <div class="truncate text-xs text-muted-foreground">
        {{ t('brand.subtitle') }}
      </div>
    </div>
  </div>
</template>
