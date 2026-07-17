<script setup lang="ts">
import { useColorMode } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

const { config } = useOrgConfig()
const { t } = useI18n()
const mode = useColorMode({ storageKey: 'vg.theme' })

function toggle(): void {
  mode.value = mode.value === 'dark' ? 'light' : 'dark'
}
</script>

<template>
  <button
    type="button"
    class="inline-flex size-7.25 items-center justify-center rounded-md border text-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
    :aria-label="t('theme.toggle')"
    :title="t('theme.toggle')"
    @click="toggle"
  >
    <Icon :spec="config.icons.toggleTheme" :size="18" />
  </button>
</template>
