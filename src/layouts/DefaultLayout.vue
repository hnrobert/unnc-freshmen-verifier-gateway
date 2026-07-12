<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import BrandMark from '@/components/BrandMark.vue'
import LanguageToggle from '@/components/LanguageToggle.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'

const { t } = useI18n()
</script>

<template>
  <div class="relative min-h-screen bg-background text-foreground">
    <div aria-hidden="true" class="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        class="absolute -top-40 left-1/2 size-[42rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
      ></div>
      <div
        class="absolute bottom-0 right-[-10%] size-[28rem] rounded-full bg-chart-2/10 blur-3xl"
      ></div>
    </div>

    <header class="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-5 py-5">
      <BrandMark />
      <div class="flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>
    </header>

    <main class="mx-auto w-full max-w-2xl px-5 pb-16">
      <slot />
    </main>

    <footer
      class="mx-auto w-full max-w-2xl px-5 pb-10 text-center text-xs leading-relaxed text-muted-foreground"
    >
      {{ t('footer') }}
    </footer>
  </div>
</template>
