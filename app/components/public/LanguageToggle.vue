<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { Locale } from '#shared/types'

const { config } = useOrgConfig()
// useScope: 'global' → same reactive locale ref that applyOrgI18n/setLocale write,
// so the active button always reflects the real locale.
const { locale } = useI18n({ useScope: 'global' })
const { setLocale } = useOrgI18n()

const options = computed(() =>
  config.value.locales.map((value) => ({ value, label: value === 'zh' ? '中' : value.toUpperCase() })),
)
</script>

<template>
  <div class="inline-flex items-center gap-1 rounded-md border p-0.5" role="group" aria-label="language">
    <Icon :spec="config.icons.toggleLanguage" :size="15" class="ml-1.5 text-muted-foreground" />
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      :class="[
        'rounded px-2 py-1 text-xs font-medium transition-colors',
        locale === opt.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
      ]"
      :aria-pressed="locale === opt.value"
      @click="setLocale(opt.value as Locale)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>
