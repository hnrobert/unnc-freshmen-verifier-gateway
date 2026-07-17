<script setup lang="ts">
import type { Locale } from '#shared/types'

const { config } = useOrgConfig()
const route = useRoute()
const slug = computed(() => route.params.slug as string)
const user = useState<{ role: string } | null>('user')
const isSuperAdmin = computed(() => user.value?.role === 'superadmin')

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

function onWelcomeImage(ref: string): void {
  config.value.welcome.image = ref
}
function onBackgroundImage(ref: string): void {
  config.value.background = {
    overlayOpacity: config.value.background?.overlayOpacity ?? 0.5,
    image: ref,
  }
}

const iconSlots = [
  'brand', 'nameField', 'idField', 'submit', 'verifying', 'welcome', 'back',
  'toggleLanguage', 'toggleTheme', 'error', 'success',
] as const

const errorKeys = ['emptyName', 'badIdFormat', 'notAdmitted', 'captcha', 'network', 'generic']
const admissionKeys = ['title', 'name', 'university', 'date', 'detail']

const msgs = computed(() => config.value.messages as Record<string, unknown>)
</script>

<template>
  <div class="space-y-8">
    <!-- Background + Welcome image (moved to top) -->
    <section class="space-y-4">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Background image</h3>
      <ImageUploader :slug="slug" image-key="background" label="Upload background" @uploaded="onBackgroundImage" />
      <Input v-model="(config.background as any).image" placeholder="./bg.jpg  or  img:background" class="h-9" />
      <div class="flex flex-wrap items-center gap-3 text-sm">
        <Label class="mb-0">overlay</Label>
        <input type="range" min="0" max="1" step="0.05" :value="(config.background as any).overlayOpacity ?? 0.5" class="w-40"
          @input="(config.background as any).overlayOpacity = Number(($event.target as HTMLInputElement).value)" />
        <span class="w-10 text-muted-foreground">{{ Math.round(((config.background as any).overlayOpacity ?? 0) * 100) }}%</span>
        <Button v-if="(config.background as any).image" size="sm" variant="ghost" type="button" @click="(config.background as any).image = ''">Remove</Button>
      </div>
      <div v-if="(config.background as any).image" class="grid gap-1.5">
        <Label>preview</Label>
        <img :src="(config.background as any).image.startsWith('img:') ? `/api/orgs/${slug}/img/${(config.background as any).image.slice(4)}` : (config.background as any).image" class="h-32 w-full rounded-lg border object-cover" />
      </div>

      <h3 class="pt-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Welcome image</h3>
      <ImageUploader :slug="slug" image-key="welcome" label="Upload welcome image" @uploaded="onWelcomeImage" />
      <Input v-model="config.welcome.image" placeholder="./welcome.svg  or  img:welcome" class="h-9" />
      <div class="flex flex-wrap gap-3 text-sm">
        <label class="flex items-center gap-1">max width <Input v-model="config.welcome.imageMaxWidth" class="h-8 w-28" /></label>
        <label class="flex items-center gap-1">radius <Input v-model="config.welcome.imageRadius" class="h-8 w-28" placeholder="0.5rem" /></label>
      </div>
      <div v-if="config.welcome.image" class="grid gap-1.5">
        <Label>preview</Label>
        <img :src="config.welcome.image.startsWith('img:') ? `/api/orgs/${slug}/img/${config.welcome.image.slice(4)}` : config.welcome.image" class="h-32 rounded-lg border object-contain" :style="{ borderRadius: config.welcome.imageRadius || '0.5rem' }" />
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
          <select v-model="config.defaultLocale" class="rounded-md border bg-transparent px-2 py-1 text-sm">
            <option v-for="l in config.locales" :key="l" :value="l">{{ l }}</option>
          </select>
        </label>
      </div>
    </section>

    <!-- Brand -->
    <section class="space-y-3">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Brand</h3>
      <LocaleField label="title" :locales="config.locales" :messages="msgs" path="brand.title" />
      <LocaleField label="subtitle" :locales="config.locales" :messages="msgs" path="brand.subtitle" />
    </section>

    <!-- Verify -->
    <section class="space-y-3">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Verify page</h3>
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
      <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Errors</h3>
      <LocaleField v-for="k in errorKeys" :key="k" :label="k" :locales="config.locales" :messages="msgs" :path="`errors.${k}`" />
    </section>

    <!-- Admission -->
    <section class="space-y-3">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Admission details</h3>
      <LocaleField v-for="k in admissionKeys" :key="k" :label="k" :locales="config.locales" :messages="msgs" :path="`admission.${k}`" />
    </section>

    <!-- Welcome text -->
    <section class="space-y-3">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Welcome page</h3>
      <LocaleField label="badge" :locales="config.locales" :messages="msgs" path="welcome.badge" />
      <LocaleField label="title" :locales="config.locales" :messages="msgs" path="welcome.title" />
      <LocaleField label="image alt" :locales="config.locales" :messages="msgs" path="welcome.imageAlt" />
      <LocaleField label="back" :locales="config.locales" :messages="msgs" path="welcome.back" />
      <div v-if="config.locales.includes('zh')" class="grid gap-1.5">
        <Label>body <span class="text-xs text-muted-foreground">zh</span> — Markdown</Label>
        <MarkdownEditor :model-value="(msgs.zh as any).welcome?.body ?? ''" @update:model-value="((msgs.zh as any).welcome ??= {}).body = $event" locale="zh" />
      </div>
      <div v-if="config.locales.includes('en')" class="grid gap-1.5">
        <Label>body <span class="text-xs text-muted-foreground">en</span> — Markdown</Label>
        <MarkdownEditor :model-value="(msgs.en as any).welcome?.body ?? ''" @update:model-value="((msgs.en as any).welcome ??= {}).body = $event" locale="en" />
      </div>
    </section>

    <!-- Footer & misc -->
    <section class="space-y-3">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Footer &amp; misc</h3>
      <LocaleField label="footer" :locales="config.locales" :messages="msgs" path="footer" />
      <LocaleField label="theme toggle" :locales="config.locales" :messages="msgs" path="theme.toggle" />
      <LocaleField label="language label" :locales="config.locales" :messages="msgs" path="lang.label" />
    </section>

    <!-- Icons -->
    <section class="space-y-3">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Icons</h3>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <IconPicker
          v-for="slot in iconSlots" :key="slot" :slug="slug" :slot-name="slot"
          :model-value="(config.icons as any)[slot]"
          @update:model-value="(config.icons as any)[slot] = $event"
        />
      </div>
    </section>

    <!-- Gateway (superadmin only) -->
    <section v-if="isSuperAdmin" class="space-y-3">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Gateway</h3>
      <div class="grid grid-cols-2 gap-3">
        <div class="grid gap-1.5">
          <Label>mode</Label>
          <select v-model="config.gateway.mode" class="rounded-md border bg-transparent px-2 py-2 text-sm">
            <option value="live">live</option>
            <option value="mock">mock</option>
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
      <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Theme</h3>
      <div class="grid gap-1.5"><Label>radius</Label><Input v-model="config.theme.radius" placeholder="0.65rem" /></div>
    </section>
  </div>
</template>
