<script setup lang="ts">
import type { Locale } from '#shared/types'

const { config } = useOrgConfig()
const route = useRoute()
const slug = computed(() => route.params.slug as string)

function toggleLocale(loc: Locale, checked: boolean): void {
  const locales = config.value.locales
  if (checked && !locales.includes(loc)) locales.push(loc)
  if (!checked && locales.length > 1) {
    const i = locales.indexOf(loc)
    if (i >= 0) locales.splice(i, 1)
  }
  if (!locales.includes(config.value.defaultLocale)) {
    config.value.defaultLocale = locales[0]!
  }
}

// Template refs for refreshing preview after re-upload
const bgPreview = ref<InstanceType<typeof import('./ImagePreview.vue').default> | null>(null)
const welcomePreview = ref<InstanceType<typeof import('./ImagePreview.vue').default> | null>(null)

function onWelcomeImage(ref: string): void {
  config.value.welcome.image = ref
  // Force preview refresh (same src value → watcher won't fire)
  setTimeout(() => welcomePreview.value?.refresh(), 100)
}
function onBackgroundImage(ref: string): void {
  config.value.background = { overlayOpacity: config.value.background?.overlayOpacity ?? 0.5, image: ref }
  setTimeout(() => bgPreview.value?.refresh(), 100)
}

const otherIconSlots = ['nameField', 'idField', 'submit', 'verifying', 'welcome', 'back', 'toggleLanguage', 'toggleTheme', 'error', 'success'] as const
const errorKeys = ['emptyName', 'badIdFormat', 'notAdmitted', 'captcha', 'network', 'generic']
const admissionKeys = ['title', 'name', 'university', 'date', 'detail']
const msgs = computed(() => config.value.messages as Record<string, unknown>)
const advancedOpen = ref(false)
</script>

<template>
  <div class="space-y-8">
    <!-- Locales (top — choose languages before editing) -->
    <section>
      <h3 class="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Locales</h3>
      <div class="flex flex-wrap items-center gap-4">
        <label class="flex items-center gap-2 text-sm">
          <input type="checkbox" :checked="config.locales.includes('zh')" @change="toggleLocale('zh', ($event.target as HTMLInputElement).checked)" /> 中文 (zh)
        </label>
        <label class="flex items-center gap-2 text-sm">
          <input type="checkbox" :checked="config.locales.includes('en')" @change="toggleLocale('en', ($event.target as HTMLInputElement).checked)" /> English (en)
        </label>
        <label class="flex items-center gap-2 text-sm">
          default:
          <select v-model="config.defaultLocale" class="rounded-md border bg-transparent px-2 py-1 text-sm">
            <option v-for="l in config.locales" :key="l" :value="l">{{ l }}</option>
          </select>
        </label>
      </div>
    </section>

    <!-- Background image -->
    <section class="space-y-4">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Background image</h3>
      <ImageUploader :slug="slug" image-key="background" label="Upload background" @uploaded="onBackgroundImage" />
      <div class="flex flex-wrap items-center gap-3 text-sm">
        <Label class="mb-0">overlay</Label>
        <input type="range" min="0" max="1" step="0.05" :value="(config.background as any).overlayOpacity ?? 0.5" class="w-40"
          @input="(config.background as any).overlayOpacity = Number(($event.target as HTMLInputElement).value)" />
        <span class="w-10 text-muted-foreground">{{ Math.round(((config.background as any).overlayOpacity ?? 0) * 100) }}%</span>
        <Button v-if="(config.background as any).image" size="sm" variant="ghost" type="button" @click="(config.background as any).image = ''">Remove</Button>
      </div>
      <div v-if="(config.background as any).image" class="grid gap-1.5">
        <Label>preview <span class="text-xs font-normal text-muted-foreground">(with overlay)</span></Label>
        <div class="relative overflow-hidden rounded-lg border" style="max-height: 50vh">
          <ImagePreview ref="bgPreview" :slug="slug" :src="(config.background as any).image" class="block" />
          <div
            v-if="!bgPreview?.failed"
            class="pointer-events-none absolute inset-0 bg-black"
            :style="{ opacity: (config.background as any).overlayOpacity ?? 0.5 }"
          />
        </div>
      </div>
    </section>

    <!-- Welcome image -->
    <section class="space-y-4">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Welcome image</h3>
      <ImageUploader :slug="slug" image-key="welcome" label="Upload welcome image" @uploaded="onWelcomeImage" />
      <div class="flex flex-wrap gap-3 text-sm">
        <label class="flex items-center gap-1">max width <Input v-model="config.welcome.imageMaxWidth" class="h-8 w-28" /></label>
        <label class="flex items-center gap-1">radius <Input v-model="config.welcome.imageRadius" class="h-8 w-28" placeholder="0.5rem" /></label>
      </div>
      <div v-if="config.welcome.image" class="grid gap-1.5">
        <Label>preview <span class="text-xs font-normal text-muted-foreground">(actual size & radius)</span></Label>
        <div class="flex justify-center" :style="{ maxWidth: config.welcome.imageMaxWidth || '12rem', margin: '0 auto' }">
          <ImagePreview ref="welcomePreview" :slug="slug" :src="config.welcome.image"
            :img-style="{ borderRadius: config.welcome.imageRadius || '0.5rem' }"
            class="shadow-sm" />
        </div>
      </div>
    </section>

    <!-- Brand -->
    <section class="space-y-3">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Brand</h3>
      <LocaleField label="title" :locales="config.locales" :messages="msgs" path="brand.title" />
      <LocaleField label="subtitle" :locales="config.locales" :messages="msgs" path="brand.subtitle" />
      <IconPicker :slug="slug" slot-name="brand"
        :model-value="(config.icons as any).brand"
        @update:model-value="(config.icons as any).brand = $event" />
    </section>

    <!-- Welcome page -->
    <section class="space-y-3">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Welcome page</h3>
      <LocaleField label="badge" :locales="config.locales" :messages="msgs" path="welcome.badge" />
      <LocaleField label="title" :locales="config.locales" :messages="msgs" path="welcome.title" />
      <div v-if="config.locales.includes('zh')" class="grid gap-1.5">
        <Label>body <span class="text-xs text-muted-foreground">zh</span> — Markdown</Label>
        <MarkdownEditor :model-value="(msgs.zh as any).welcome?.body ?? ''" @update:model-value="((msgs.zh as any).welcome ??= {}).body = $event" locale="zh" />
      </div>
      <div v-if="config.locales.includes('en')" class="grid gap-1.5">
        <Label>body <span class="text-xs text-muted-foreground">en</span> — Markdown</Label>
        <MarkdownEditor :model-value="(msgs.en as any).welcome?.body ?? ''" @update:model-value="((msgs.en as any).welcome ??= {}).body = $event" locale="en" />
      </div>
    </section>

    <!-- ===== Advanced (collapsible) ===== -->
    <div class="rounded-lg border">
      <button
        class="flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-semibold transition-colors hover:bg-accent"
        @click="advancedOpen = !advancedOpen"
      >
        <span class="flex items-center gap-2">
          <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></svg>
          Advanced settings
        </span>
        <svg viewBox="0 0 24 24" class="size-4 transition-transform" :class="advancedOpen ? 'rotate-180' : ''" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9" /></svg>
      </button>

      <div v-show="advancedOpen" class="space-y-8 border-t p-4">
        <!-- Welcome extras
        <section class="space-y-3">
          <h4 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Welcome page (extra)</h4>
          <LocaleField label="image alt" :locales="config.locales" :messages="msgs" path="welcome.imageAlt" />
          <LocaleField label="back" :locales="config.locales" :messages="msgs" path="welcome.back" />
        </section>

        <!-- Verify -->
        <section class="space-y-3">
          <h4 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Verify page</h4>
          <LocaleField label="heading" :locales="config.locales" :messages="msgs" path="verify.heading" />
          <LocaleField label="subheading" :locales="config.locales" :messages="msgs" path="verify.subheading" />
          <LocaleField label="name label" :locales="config.locales" :messages="msgs" path="verify.nameLabel" />
          <LocaleField label="name placeholder" :locales="config.locales" :messages="msgs" path="verify.namePlaceholder" />
          <LocaleField label="id label" :locales="config.locales" :messages="msgs" path="verify.idLabel" />
          <LocaleField label="id placeholder" :locales="config.locales" :messages="msgs" path="verify.idPlaceholder" />
          <LocaleField label="submit" :locales="config.locales" :messages="msgs" path="verify.submit" />
          <LocaleField label="hint" :locales="config.locales" :messages="msgs" path="verify.hint" />
        </section>

        <!-- Errors -->
        <section class="space-y-3">
          <h4 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Errors</h4>
          <LocaleField v-for="k in errorKeys" :key="k" :label="k" :locales="config.locales" :messages="msgs" :path="`errors.${k}`" />
        </section>

        <!-- Admission -->
        <section class="space-y-3">
          <h4 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Admission details</h4>
          <LocaleField v-for="k in admissionKeys" :key="k" :label="k" :locales="config.locales" :messages="msgs" :path="`admission.${k}`" />
        </section>

        <!-- Footer & misc -->
        <section class="space-y-3">
          <h4 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Footer &amp; misc</h4>
          <LocaleField label="footer" :locales="config.locales" :messages="msgs" path="footer" />
          <LocaleField label="theme toggle" :locales="config.locales" :messages="msgs" path="theme.toggle" />
          <LocaleField label="language label" :locales="config.locales" :messages="msgs" path="lang.label" />
        </section>

        <!-- Other icons -->
        <section class="space-y-3">
          <h4 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Icons (other)</h4>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <IconPicker v-for="slot in otherIconSlots" :key="slot" :slug="slug" :slot-name="slot"
              :model-value="(config.icons as any)[slot]"
              @update:model-value="(config.icons as any)[slot] = $event" />
          </div>
        </section>

        <!-- Gateway -->
        <section class="space-y-3">
          <h4 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Gateway</h4>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div class="grid gap-1.5">
              <Label>mode</Label>
              <select v-model="config.gateway.mode" class="rounded-md border bg-transparent px-2 py-2 text-sm">
                <option value="live">live</option><option value="mock">mock</option>
              </select>
            </div>
            <div class="grid gap-1.5"><Label>baseUrl</Label><Input v-model="config.gateway.baseUrl" /></div>
            <div class="grid gap-1.5"><Label>maxCaptchaRounds</Label><Input v-model.number="config.gateway.maxCaptchaRounds" type="number" /></div>
            <div class="grid gap-1.5"><Label>maxOffsetTries</Label><Input v-model.number="config.gateway.maxOffsetTries" type="number" /></div>
            <div class="grid gap-1.5"><Label>requestTimeoutMs</Label><Input v-model.number="config.gateway.requestTimeoutMs" type="number" /></div>
          </div>
        </section>

        <!-- Theme -->
        <section class="space-y-3">
          <h4 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Theme</h4>
          <div class="grid gap-1.5"><Label>radius</Label><Input v-model="config.theme.radius" placeholder="0.65rem" /></div>
        </section>
      </div>
    </div>
  </div>
</template>
