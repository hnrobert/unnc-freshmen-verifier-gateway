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

// Strip/add "rem" so inputs show only numbers with unit as suffix label
const maxWidthNum = computed({
  get: () => parseFloat(config.value.welcome.imageMaxWidth || '12') || 0,
  set: (v: number) => { config.value.welcome.imageMaxWidth = `${v}rem` },
})
const radiusNum = computed({
  get: () => parseFloat(config.value.welcome.imageRadius || '0.5') || 0,
  set: (v: number) => { config.value.welcome.imageRadius = `${v}rem` },
})
const themeRadiusNum = computed({
  get: () => parseFloat(config.value.theme.radius || '0.65') || 0,
  set: (v: number) => { config.value.theme.radius = `${v}rem` },
})

// Compute contrast foreground for primary color
function contrastFg(hex: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return '#1c1917'
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return 0.299 * r + 0.587 * g + 0.114 * b > 0.55 ? '#1c1917' : '#fafafa'
}
// Scoped CSS vars for org theme color — applied to the ConfigEditor root div,
// NOT documentElement, so the dashboard sidebar/nav keeps its default color.
const primaryVars = computed(() => {
  const c = (config.value.theme as unknown as Record<string, unknown>).primaryColor as string || '#F7D447'
  return {
    '--primary': c,
    '--primary-foreground': contrastFg(c),
    '--ring': c,
    'accent-color': c,
  } as Record<string, string>
})

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
  <div class="space-y-8" :style="primaryVars">
    <!-- Theme color (top — visible immediately) -->
    <section>
      <h3 class="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Theme color</h3>
      <div class="flex items-center gap-3">
        <input
          type="color"
          :value="(config.theme as any).primaryColor || '#F7D447'"
          class="vg-color-input size-9 cursor-pointer rounded-lg border border-input"
          @input="(config.theme as any).primaryColor = ($event.target as HTMLInputElement).value"
        />
        <Input
          :model-value="(config.theme as any).primaryColor || '#F7D447'"
          class="h-9 w-32"
          @update:model-value="(config.theme as any).primaryColor = String($event)"
        />
        <Button
          v-if="(config.theme as any).primaryColor && (config.theme as any).primaryColor !== '#F7D447'"
          size="sm" variant="ghost" type="button"
          @click="(config.theme as any).primaryColor = '#F7D447'"
        >Reset</Button>
      </div>
    </section>

    <!-- Locales -->
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
          <select v-model="config.defaultLocale" class="h-9 rounded-md border bg-transparent px-2 text-sm">
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
        <Label>preview <span class="text-xs font-normal text-muted-foreground">(background-cover + overlay)</span></Label>
        <!-- Hidden ImagePreview just to fetch the base64 -->
        <ImagePreview v-show="false" ref="bgPreview" :slug="slug" :src="(config.background as any).image" />
        <!-- Actual preview: fixed-height div with background-image, centered, cover -->
        <div
          v-if="bgPreview?.resolved && !bgPreview?.failed"
          class="relative h-144 max-h-[60vh] overflow-hidden rounded-lg"
          :style="{ backgroundImage: `url(${bgPreview.resolved})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }"
        >
          <div
            class="pointer-events-none absolute inset-0 bg-white dark:bg-black"
            :style="{ opacity: (config.background as any).overlayOpacity ?? 0.5 }"
          />
        </div>
        <div
          v-else-if="bgPreview?.failed"
          class="flex h-144 max-h-[60vh] items-center justify-center rounded-lg border bg-muted text-muted-foreground"
        >
          <svg viewBox="0 0 24 24" class="size-8" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h9" /><path d="m9 9 5 5" /><path d="M14 9v5" /><path d="M9 14h5" /></svg>
        </div>
      </div>
    </section>

    <!-- Welcome image -->
    <section class="space-y-4">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Welcome image</h3>
      <ImageUploader :slug="slug" image-key="welcome" label="Upload welcome image" @uploaded="onWelcomeImage" />
      <div v-if="config.welcome.image" class="space-y-3">
        <div class="flex flex-wrap gap-3 text-sm">
          <label class="flex items-center gap-1">max width
            <Input v-model.number="maxWidthNum" type="number" step="1" class="h-8 w-20" />
            <span class="text-xs text-muted-foreground">rem</span>
          </label>
          <label class="flex items-center gap-1">radius
            <Input v-model.number="radiusNum" type="number" step="0.1" class="h-8 w-20" />
            <span class="text-xs text-muted-foreground">rem</span>
          </label>
        </div>
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
              <select v-model="config.gateway.mode" class="h-9 rounded-md border bg-transparent px-2 text-sm">
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
          <div class="flex items-center gap-2 text-sm">
            <Label class="mb-0">radius</Label>
            <Input v-model.number="themeRadiusNum" type="number" step="0.05" class="h-8 w-20" />
            <span class="text-xs text-muted-foreground">rem</span>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.vg-color-input {
  padding: 0;
  overflow: hidden;
}
.vg-color-input::-webkit-color-swatch-wrapper {
  padding: 0;
}
.vg-color-input::-webkit-color-swatch {
  border: none;
  border-radius: calc(var(--radius) - 4px);
}
.vg-color-input::-moz-color-swatch {
  border: none;
  border-radius: calc(var(--radius) - 4px);
}
</style>
