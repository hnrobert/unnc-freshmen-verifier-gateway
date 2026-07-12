<script setup lang="ts">
import { useColorMode } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import siteConfig from '@config/site.config'
import Icon from '@/components/Icon.vue'

const { t } = useI18n()
const mode = useColorMode({ storageKey: 'unnc-vg.theme' })

function toggle(): void {
  mode.value = mode.value === 'dark' ? 'light' : 'dark'
}
</script>

<template>
  <button
    type="button"
    class="inline-flex size-9 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    :aria-label="t('theme.toggle')"
    :title="t('theme.toggle')"
    @click="toggle"
  >
    <Icon :spec="siteConfig.icons.toggleTheme" :size="18" />
  </button>
</template>
