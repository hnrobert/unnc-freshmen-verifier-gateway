<script setup lang="ts">
import type { Locale } from '#shared/types'

const { config } = useOrgConfig()

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

const iconSlots = [
  'brand', 'nameField', 'idField', 'submit', 'verifying', 'welcome', 'back',
  'toggleLanguage', 'toggleTheme', 'error', 'success',
] as const

const route = useRoute()
const slug = computed(() => route.params.slug as string)

function onWelcomeImage(ref: string): void {
  config.value.welcome.image = ref
}

function onBackgroundImage(ref: string): void {
  config.value.background = {
    overlayOpacity: config.value.background?.overlayOpacity ?? 0.5,
    image: ref,
  }
}
</script>

<template>
  <div class="space-y-8">
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
      <div class="grid gap-1.5"><Label>标题 / Title (zh)</Label><Input v-model="(config.messages.zh as any).brand.title" /></div>
      <div class="grid gap-1.5"><Label>Title (en)</Label><Input v-model="(config.messages.en as any).brand.title" /></div>
      <div class="grid gap-1.5"><Label>副标题 / Subtitle (zh)</Label><Input v-model="(config.messages.zh as any).brand.subtitle" /></div>
      <div class="grid gap-1.5"><Label>Subtitle (en)</Label><Input v-model="(config.messages.en as any).brand.subtitle" /></div>
    </section>

    <!-- Verify -->
    <section class="space-y-3">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Verify page</h3>
      <div class="grid grid-cols-2 gap-3">
        <div class="grid gap-1.5"><Label>heading (zh)</Label><Input v-model="(config.messages.zh as any).verify.heading" /></div>
        <div class="grid gap-1.5"><Label>heading (en)</Label><Input v-model="(config.messages.en as any).verify.heading" /></div>
        <div class="grid gap-1.5"><Label>subheading (zh)</Label><Input v-model="(config.messages.zh as any).verify.subheading" /></div>
        <div class="grid gap-1.5"><Label>subheading (en)</Label><Input v-model="(config.messages.en as any).verify.subheading" /></div>
        <div class="grid gap-1.5"><Label>nameLabel (zh)</Label><Input v-model="(config.messages.zh as any).verify.nameLabel" /></div>
        <div class="grid gap-1.5"><Label>nameLabel (en)</Label><Input v-model="(config.messages.en as any).verify.nameLabel" /></div>
        <div class="grid gap-1.5"><Label>namePlaceholder (zh)</Label><Input v-model="(config.messages.zh as any).verify.namePlaceholder" /></div>
        <div class="grid gap-1.5"><Label>namePlaceholder (en)</Label><Input v-model="(config.messages.en as any).verify.namePlaceholder" /></div>
        <div class="grid gap-1.5"><Label>idLabel (zh)</Label><Input v-model="(config.messages.zh as any).verify.idLabel" /></div>
        <div class="grid gap-1.5"><Label>idLabel (en)</Label><Input v-model="(config.messages.en as any).verify.idLabel" /></div>
        <div class="grid gap-1.5"><Label>idPlaceholder (zh)</Label><Input v-model="(config.messages.zh as any).verify.idPlaceholder" /></div>
        <div class="grid gap-1.5"><Label>idPlaceholder (en)</Label><Input v-model="(config.messages.en as any).verify.idPlaceholder" /></div>
        <div class="grid gap-1.5"><Label>submit (zh)</Label><Input v-model="(config.messages.zh as any).verify.submit" /></div>
        <div class="grid gap-1.5"><Label>submit (en)</Label><Input v-model="(config.messages.en as any).verify.submit" /></div>
        <div class="grid gap-1.5"><Label>hint (zh)</Label><Input v-model="(config.messages.zh as any).verify.hint" /></div>
        <div class="grid gap-1.5"><Label>hint (en)</Label><Input v-model="(config.messages.en as any).verify.hint" /></div>
      </div>
    </section>

    <!-- Errors -->
    <section class="space-y-3">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Errors</h3>
      <div class="grid grid-cols-2 gap-3">
        <div v-for="k in ['emptyName','badIdFormat','notAdmitted','captcha','network','generic']" :key="k" class="grid gap-1.5">
          <Label>{{ k }} (zh)</Label><Input v-model="(config.messages.zh as any).errors[k]" />
          <Label>{{ k }} (en)</Label><Input v-model="(config.messages.en as any).errors[k]" />
        </div>
      </div>
    </section>

    <!-- Admission -->
    <section class="space-y-3">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Admission details labels</h3>
      <div class="grid grid-cols-2 gap-3">
        <div v-for="k in ['title','name','university','date','detail']" :key="k" class="grid gap-1.5">
          <Label>{{ k }} (zh)</Label><Input v-model="(config.messages.zh as any).admission[k]" />
          <Label>{{ k }} (en)</Label><Input v-model="(config.messages.en as any).admission[k]" />
        </div>
      </div>
    </section>

    <!-- Welcome -->
    <section class="space-y-3">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Welcome page</h3>
      <div class="grid grid-cols-2 gap-3">
        <div class="grid gap-1.5"><Label>badge (zh)</Label><Input v-model="(config.messages.zh as any).welcome.badge" /></div>
        <div class="grid gap-1.5"><Label>badge (en)</Label><Input v-model="(config.messages.en as any).welcome.badge" /></div>
        <div class="grid gap-1.5"><Label>title (zh)</Label><Input v-model="(config.messages.zh as any).welcome.title" /></div>
        <div class="grid gap-1.5"><Label>title (en)</Label><Input v-model="(config.messages.en as any).welcome.title" /></div>
        <div class="grid gap-1.5"><Label>imageAlt (zh)</Label><Input v-model="(config.messages.zh as any).welcome.imageAlt" /></div>
        <div class="grid gap-1.5"><Label>imageAlt (en)</Label><Input v-model="(config.messages.en as any).welcome.imageAlt" /></div>
        <div class="grid gap-1.5"><Label>back (zh)</Label><Input v-model="(config.messages.zh as any).welcome.back" /></div>
        <div class="grid gap-1.5"><Label>back (en)</Label><Input v-model="(config.messages.en as any).welcome.back" /></div>
      </div>
      <div class="grid gap-1.5">
        <Label>welcome image</Label>
        <ImageUploader :slug="slug" image-key="welcome" label="Upload welcome image (base64 → DB)" @uploaded="onWelcomeImage" />
        <Input v-model="config.welcome.image" placeholder="./welcome.svg  or  img:welcome" />
        <div class="flex gap-3 text-sm">
          <label class="flex items-center gap-1">max width <Input v-model="config.welcome.imageMaxWidth" class="h-8 w-28" /></label>
          <label class="flex items-center gap-1"><input type="checkbox" v-model="config.welcome.imageRounded" /> rounded</label>
        </div>
      </div>
      <div class="grid gap-1.5">
        <Label>body (zh) — Markdown</Label>
        <MarkdownEditor v-model="(config.messages.zh as any).welcome.body" locale="zh" />
      </div>
      <div class="grid gap-1.5">
        <Label>body (en) — Markdown</Label>
        <MarkdownEditor v-model="(config.messages.en as any).welcome.body" locale="en" />
      </div>
    </section>

    <!-- Background -->
    <section class="space-y-3">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Page background (optional)</h3>
      <ImageUploader :slug="slug" image-key="background" label="Upload background image (base64 → DB)" @uploaded="onBackgroundImage" />
      <div class="grid gap-1.5">
        <Label>background image (URL or img:background)</Label>
        <Input v-model="(config.background as any).image" placeholder="./bg.jpg  or  img:background  or  https://…" />
      </div>
      <div class="flex flex-wrap items-center gap-3 text-sm">
        <Label class="mb-0">darkening overlay</Label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          :value="(config.background as any).overlayOpacity ?? 0.5"
          class="w-48"
          @input="(config.background as any).overlayOpacity = Number(($event.target as HTMLInputElement).value)"
        />
        <span class="w-10 text-muted-foreground">{{ Math.round(((config.background as any).overlayOpacity ?? 0) * 100) }}%</span>
        <Button v-if="(config.background as any).image" size="sm" variant="ghost" type="button" @click="(config.background as any).image = ''">Remove image</Button>
      </div>
    </section>

    <!-- Footer / misc -->
    <section class="space-y-3">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Footer &amp; misc</h3>
      <div class="grid grid-cols-2 gap-3">
        <div class="grid gap-1.5"><Label>footer (zh)</Label><Input v-model="(config.messages.zh as any).footer" /></div>
        <div class="grid gap-1.5"><Label>footer (en)</Label><Input v-model="(config.messages.en as any).footer" /></div>
        <div class="grid gap-1.5"><Label>theme.toggle (zh)</Label><Input v-model="(config.messages.zh as any).theme.toggle" /></div>
        <div class="grid gap-1.5"><Label>theme.toggle (en)</Label><Input v-model="(config.messages.en as any).theme.toggle" /></div>
        <div class="grid gap-1.5"><Label>lang.label (zh)</Label><Input v-model="(config.messages.zh as any).lang.label" /></div>
        <div class="grid gap-1.5"><Label>lang.label (en)</Label><Input v-model="(config.messages.en as any).lang.label" /></div>
      </div>
    </section>

    <!-- Icons -->
    <section class="space-y-3">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Icons</h3>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <IconPicker
          v-for="slot in iconSlots"
          :key="slot"
          :slug="slug"
          :slot-name="slot"
          :model-value="(config.icons as any)[slot]"
          @update:model-value="(config.icons as any)[slot] = $event"
        />
      </div>
    </section>

    <!-- Gateway -->
    <section class="space-y-3">
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
        <div class="grid gap-1.5"><Label>proxy (optional)</Label><Input v-model="config.gateway.proxy" placeholder="remote {url} template" /></div>
      </div>
    </section>

    <!-- Theme -->
    <section class="space-y-3">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Theme</h3>
      <div class="grid gap-1.5"><Label>radius</Label><Input v-model="config.theme.radius" placeholder="0.65rem" /></div>
    </section>
  </div>
</template>
