<script setup lang="ts">
import QRCode from 'qrcode'
import {
  POSTER_W,
  POSTER_H,
  POSTER_QR_CARD,
  POSTER_QR_TOP,
  POSTER_TITLE_CENTER,
  POSTER_THEMES,
  posterPalette,
  wrapTitle,
  type PosterTheme,
} from '#shared/lib/poster'
import type { PosterSettings, SiteConfig } from '#shared/types'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const slug = computed(() => route.params.slug as string)

// Public verify-page URL — useRequestURL() resolves the real origin on both
// SSR (from the request) and client (from window.location), so this works on
// localhost, HTTPS tunnels, and prod alike.
const publicUrl = computed(() => `${useRequestURL().origin}/${slug.value}`)

// qrcode is isomorphic → SSR generates the PNG data URL (no client-only needed).
const qr = await QRCode.toDataURL(publicUrl.value, {
  width: 240,
  margin: 2,
  color: { dark: '#1c1917', light: '#ffffff' },
})

function downloadQr() {
  const a = document.createElement('a')
  a.href = qr
  a.download = `${slug.value}-qr.png`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(publicUrl.value)
    toast.success('Link copied')
  } catch {
    toast.error('Could not copy link')
  }
}

// ---------------------------------------------------------------------------
// Share poster (Microsoft-Forms style: background + title + URL + QR).
// Rendering happens CLIENT-SIDE on a canvas (instant preview + PNG export);
// the server renders the same layout at /api/pages/<slug>/poster for iframe
// embedding and hot-linking.
// ---------------------------------------------------------------------------

// Raw config (editor view) for the stored poster title + brand fallback;
// resolved public config for the background image (already inlined data:).
const { data: access } = await useFetch<{ role: string; rank: number }>(
  () => `/api/pages/${slug.value}/access`,
  { watch: [slug] },
)
const { data: rawConfig } = await useFetch<SiteConfig>(
  () => `/api/pages/${slug.value}/config?edit=1`,
  { watch: [slug] },
)
const { data: pubConfig } = await useFetch<SiteConfig>(() => `/api/pages/${slug.value}/config`, {
  watch: [slug],
})
const { data: posterSettings } = await useFetch<PosterSettings>(
  () => `/api/pages/${slug.value}/poster/settings`,
  { watch: [slug] },
)

const { data: myPages } = await useFetch<{ pages: { slug: string; name: string }[] }>('/api/pages')
const brandTitle = computed(() => {
  const loc = rawConfig.value?.defaultLocale ?? 'zh'
  const brand = (rawConfig.value?.messages?.[loc]?.brand ?? {}) as { title?: string }
  const pageName = myPages.value?.pages.find((p) => p.slug === slug.value)?.name ?? slug.value
  return (brand.title ?? '').trim() || pageName
})
const storedPosterTitle = computed(() => (posterSettings.value?.title ?? '').trim())

const posterTitle = ref('')
const posterTheme = ref<PosterTheme>('page')
const posterFontSize = ref(60)
const posterWidth = ref(POSTER_W)
const posterHeight = ref(POSTER_H)
const posterBorder = ref(0)
const posterBorderRadius = ref(28)
const originalPosterSettings = ref<PosterSettings>({
  title: '',
  theme: 'page',
  fontSize: 60,
  width: POSTER_W,
  height: POSTER_H,
  border: 0,
  borderRadius: 28,
})
watch(
  posterSettings,
  (value) => {
    if (!value) return
    originalPosterSettings.value = { ...value }
    posterTitle.value = value.title
    posterTheme.value = value.theme
    posterFontSize.value = value.fontSize
    posterWidth.value = value.width
    posterHeight.value = value.height
    posterBorder.value = value.border
    posterBorderRadius.value = value.borderRadius
  },
  { immediate: true },
)
const themeLabels: Record<PosterTheme, string> = {
  page: 'Page background',
  dark: 'Dark',
  light: 'Light',
  primary: 'Primary',
}

const canvasEl = ref<HTMLCanvasElement | null>(null)
const bgImage = ref<HTMLImageElement | null>(null)
const qrImage = ref<HTMLImageElement | null>(null)
const rendering = ref(false)

// Load the pieces the canvas needs (background data URL + QR as images).
watchEffect(async () => {
  const ref = pubConfig.value?.background?.image
  const src = ref && (ref.startsWith('data:') || ref.startsWith('http')) ? ref : undefined
  const [bg, qrImg] = await Promise.all([
    src ? loadImage(src).catch(() => null) : Promise.resolve(null),
    loadImage(qr).catch(() => null),
  ])
  bgImage.value = bg
  qrImage.value = qrImg
})

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image load failed'))
    img.src = src
  })
}

const effectiveTitle = computed(
  () => posterTitle.value.trim() || storedPosterTitle.value || brandTitle.value,
)

/** Canvas mirror of the server layout (see poster/image.get.ts). */
function drawPoster(): void {
  const canvas = canvasEl.value
  if (!canvas) return
  canvas.width = posterWidth.value
  canvas.height = posterHeight.value
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.save()
  ctx.scale(posterWidth.value / POSTER_W, posterHeight.value / POSTER_H)

  const theme = posterTheme.value === 'page' && !bgImage.value ? 'dark' : posterTheme.value
  const palette = posterPalette(theme, pubConfig.value?.theme.primaryColor ?? '#F7D447')

  // Background
  if (posterTheme.value === 'page' && bgImage.value) {
    const img = bgImage.value
    const scale = Math.max(POSTER_W / img.width, POSTER_H / img.height)
    const w = img.width * scale
    const h = img.height * scale
    ctx.drawImage(img as unknown as CanvasImageSource, (POSTER_W - w) / 2, (POSTER_H - h) / 2, w, h)
    ctx.fillStyle = 'rgba(10,10,10,0.5)'
    ctx.fillRect(0, 0, POSTER_W, POSTER_H)
  } else if (theme === 'primary') {
    const grad = ctx.createLinearGradient(0, 0, POSTER_W, POSTER_H)
    grad.addColorStop(0, pubConfig.value?.theme.primaryColor ?? '#F7D447')
    grad.addColorStop(1, '#141414')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, POSTER_W, POSTER_H)
  } else {
    ctx.fillStyle = palette.bg
    ctx.fillRect(0, 0, POSTER_W, POSTER_H)
  }

  // Title (wrapped, ≤3 lines) centered in the upper third — no URL baked in
  // (Microsoft-Forms portrait layout).
  ctx.textAlign = 'center'
  ctx.fillStyle = palette.text
  ctx.font = `700 ${posterFontSize.value}px -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif`
  const lines = wrapTitle(effectiveTitle.value, posterFontSize.value, 880, 3)
  const lineHeight = Math.round(posterFontSize.value * 1.23)
  const startY =
    POSTER_TITLE_CENTER + posterFontSize.value / 2 - ((lines.length - 1) * lineHeight) / 2
  lines.forEach((l, i) => ctx.fillText(l, POSTER_W / 2, startY + i * lineHeight))

  // QR card (large, horizontally centered, white rounded card)
  const cardX = (POSTER_W - POSTER_QR_CARD) / 2
  const cardY = POSTER_QR_TOP
  ctx.fillStyle = '#ffffff'
  roundRect(ctx, cardX, cardY, POSTER_QR_CARD, POSTER_QR_CARD, posterBorderRadius.value)
  ctx.fill()
  if (posterBorder.value) {
    ctx.strokeStyle = '#1c1917'
    ctx.lineWidth = posterBorder.value
    ctx.stroke()
  }
  if (qrImage.value)
    ctx.drawImage(
      qrImage.value as unknown as CanvasImageSource,
      cardX + 44,
      cardY + 44,
      POSTER_QR_CARD - 88,
      POSTER_QR_CARD - 88,
    )
  ctx.restore()
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// Redraw whenever any input changes (canvas exists client-side only). The
// deps must be read synchronously HERE: drawPoster runs inside a rAF callback,
// outside the effect's tracking scope — without this line changing the theme/
// title/background would never re-render.
watchEffect(() => {
  void [
    posterTheme.value,
    effectiveTitle.value,
    posterFontSize.value,
    posterWidth.value,
    posterHeight.value,
    posterBorder.value,
    posterBorderRadius.value,
    bgImage.value,
    qrImage.value,
  ]
  if (import.meta.client && canvasEl.value) {
    rendering.value = true
    requestAnimationFrame(() => {
      drawPoster()
      rendering.value = false
    })
  }
})

function downloadPoster(): void {
  const canvas = canvasEl.value
  if (!canvas) return
  canvas.toBlob((blob) => {
    if (!blob) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${slug.value}-poster.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(a.href)
  }, 'image/png')
}

const posterQuery = computed(() => {
  const params = new URLSearchParams()
  if (posterTitle.value.trim()) params.set('title', posterTitle.value.trim())
  if (posterTheme.value !== 'page') params.set('theme', posterTheme.value)
  params.set('fontSize', String(posterFontSize.value))
  params.set('width', String(posterWidth.value))
  params.set('height', String(posterHeight.value))
  params.set('border', String(posterBorder.value))
  params.set('borderRadius', String(posterBorderRadius.value))
  const s = params.toString()
  return s ? `?${s}` : ''
})
const posterUrl = computed(
  () => `${useRequestURL().origin}/api/pages/${slug.value}/poster/image${posterQuery.value}`,
)
const iframeSnippet = computed(
  () =>
    `<iframe src="${publicUrl.value.replace(/\/[^/]*$/, '')}/api/pages/${slug.value}/poster${posterQuery.value}" width="480" height="680" style="border:0;border-radius:12px" loading="lazy" title="${effectiveTitle.value.replace(/"/g, '&quot;')}"></iframe>`,
)

async function copyText(text: string, what: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`${what} copied`)
  } catch {
    toast.error(`Could not copy ${what.toLowerCase()}`)
  }
}

// Persist the custom title as the page's poster default (editor+).
const saving = ref(false)
const canSave = computed(() => (access.value?.rank ?? 0) >= 2)
const posterDirty = computed(
  () =>
    posterTitle.value.trim() !== originalPosterSettings.value.title ||
    posterTheme.value !== originalPosterSettings.value.theme ||
    posterFontSize.value !== originalPosterSettings.value.fontSize ||
    posterWidth.value !== originalPosterSettings.value.width ||
    posterHeight.value !== originalPosterSettings.value.height ||
    posterBorder.value !== originalPosterSettings.value.border ||
    posterBorderRadius.value !== originalPosterSettings.value.borderRadius,
)

async function onSave(): Promise<boolean> {
  try {
    const saved = await $fetch<PosterSettings>(`/api/pages/${slug.value}/poster/settings`, {
      method: 'PUT',
      body: {
        title: posterTitle.value.trim(),
        theme: posterTheme.value,
        fontSize: posterFontSize.value,
        width: posterWidth.value,
        height: posterHeight.value,
        border: posterBorder.value,
        borderRadius: posterBorderRadius.value,
      },
    })
    originalPosterSettings.value = { ...saved }
    toast.success('Poster settings saved')
    return true
  } catch (e) {
    toast.error(messageFromError(e, 'Could not save'))
    return false
  }
}

function onDiscard(): void {
  posterTitle.value = originalPosterSettings.value.title
  posterTheme.value = originalPosterSettings.value.theme
  posterFontSize.value = originalPosterSettings.value.fontSize
  posterWidth.value = originalPosterSettings.value.width
  posterHeight.value = originalPosterSettings.value.height
  posterBorder.value = originalPosterSettings.value.border
  posterBorderRadius.value = originalPosterSettings.value.borderRadius
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-lg font-semibold tracking-tight">Share</h2>
      <p class="mt-1 text-sm text-muted-foreground">
        Anyone with this link can use the public verify page at <code>/{{ slug }}</code
        >.
      </p>
    </div>

    <div class="flex items-center gap-2 rounded-md border bg-muted/40 p-3 text-sm">
      <code class="min-w-0 ml-2 flex-1 truncate">{{ publicUrl }}</code>
      <Button variant="ghost" size="sm" @click="copyLink">Copy</Button>
    </div>

    <!-- QR + poster generator side by side (Microsoft-Forms share panel feel) -->
    <div class="grid gap-6 lg:grid-cols-[auto_1fr]">
      <Card class="self-start">
        <CardHeader>
          <CardTitle class="text-base">QR code</CardTitle>
          <CardDescription>Scanning opens the public verify page.</CardDescription>
        </CardHeader>
        <CardContent class="flex flex-col items-center gap-4">
          <img :src="qr" :alt="`QR code for ${publicUrl}`" class="size-44 rounded-lg border" />
          <Button size="sm" @click="downloadQr">
            <Icon spec="Download" :size="16" /> Download QR
          </Button>
        </CardContent>
      </Card>

      <!-- Share poster generator -->
      <Card>
        <CardHeader>
          <CardTitle class="text-base">Share poster</CardTitle>
          <CardDescription>
            Generate a poster with the page background, a custom title and the QR code — export as
            PNG, or embed via iframe.
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="grid gap-1.5">
            <Label for="poster-title">Title</Label>
            <Input
              id="poster-title"
              v-model="posterTitle"
              :placeholder="storedPosterTitle || brandTitle"
              :disabled="saving"
            />
            <p class="text-xs text-muted-foreground">
              Empty uses {{ storedPosterTitle ? 'the saved title' : 'the page title' }}.
            </p>
          </div>

          <div class="grid gap-1.5">
            <Label>Background</Label>
            <div class="flex flex-wrap gap-2">
              <Button
                v-for="t in POSTER_THEMES"
                :key="t"
                size="sm"
                :variant="posterTheme === t ? 'default' : 'outline'"
                :disabled="t === 'page' && !pubConfig?.background?.image"
                @click="posterTheme = t"
              >
                {{ themeLabels[t] }}
              </Button>
            </div>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div class="grid gap-1.5">
              <Label for="poster-font-size">Font size</Label>
              <Input
                id="poster-font-size"
                v-model.number="posterFontSize"
                type="number"
                min="12"
                max="180"
                :disabled="saving"
              />
            </div>
            <div class="grid gap-1.5">
              <Label for="poster-width">Width</Label>
              <Input
                id="poster-width"
                v-model.number="posterWidth"
                type="number"
                min="240"
                max="1080"
                :disabled="saving"
              />
            </div>
            <div class="grid gap-1.5">
              <Label for="poster-height">Height</Label>
              <Input
                id="poster-height"
                v-model.number="posterHeight"
                type="number"
                min="240"
                max="1440"
                :disabled="saving"
              />
            </div>
            <div class="grid gap-1.5">
              <Label for="poster-border">Border</Label>
              <Input
                id="poster-border"
                v-model.number="posterBorder"
                type="number"
                min="0"
                max="40"
                :disabled="saving"
              />
            </div>
            <div class="grid gap-1.5">
              <Label for="poster-border-radius">Border-radius</Label>
              <Input
                id="poster-border-radius"
                v-model.number="posterBorderRadius"
                type="number"
                min="0"
                max="120"
                :disabled="saving"
              />
            </div>
          </div>

          <!-- Canvas preview (client-rendered, same layout as the server poster) -->
          <div class="mx-auto max-w-88 overflow-hidden rounded-lg border bg-muted/40">
            <canvas
              ref="canvasEl"
              class="block w-full"
              :style="{ aspectRatio: `${posterWidth} / ${posterHeight}` }"
            />
          </div>

          <div class="flex flex-wrap gap-2">
            <Button size="sm" @click="downloadPoster">
              <Icon spec="Download" :size="16" /> Download PNG
            </Button>
          </div>

          <div class="grid gap-1.5">
            <Label>Embed (iframe)</Label>
            <textarea
              readonly
              rows="3"
              class="w-full resize-none rounded-md border bg-muted/40 p-2 font-mono text-xs"
              :value="iframeSnippet"
              @focus="($event.target as HTMLTextAreaElement).select()"
            />
            <div class="flex gap-2">
              <Button size="sm" variant="outline" @click="copyText(iframeSnippet, 'Embed code')">
                <Icon spec="Copy" :size="16" /> Copy embed code
              </Button>
              <Button size="sm" variant="outline" @click="copyText(posterUrl, 'Image link')">
                <Icon spec="Link" :size="16" /> Copy image link
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
    <GuardedSave
      v-if="canSave"
      v-model:saving="saving"
      :dirty="posterDirty"
      :on-save="onSave"
      :on-discard="onDiscard"
    />
  </div>
</template>
