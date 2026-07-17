<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { isImageIcon } from '~/lib/icon'

const { config } = useOrgConfig()
const { t } = useI18n()

const brandIsImg = computed(() => isImageIcon(config.value.icons.brand))
</script>

<template>
  <div class="flex min-w-0 items-center gap-3">
    <span
      class="flex size-10 shrink-0 items-center justify-center rounded-md text-primary-foreground shadow-sm overflow-hidden"
      :class="{ 'bg-primary': !brandIsImg }"
    >
      <Icon :spec="config.icons.brand" :size="22" :cover="brandIsImg" />
    </span>
    <div class="min-w-0">
      <div class="truncate text-sm font-semibold leading-tight sm:text-base">{{ t('brand.title') }}</div>
      <div class="truncate text-xs text-foreground/60">{{ t('brand.subtitle') }}</div>
    </div>
  </div>
</template>
