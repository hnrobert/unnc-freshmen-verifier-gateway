<script setup lang="ts">
import QRCode from 'qrcode'

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
</script>

<template>
  <div class="max-w-md space-y-6">
    <div>
      <h2 class="text-lg font-semibold tracking-tight">Share</h2>
      <p class="mt-1 text-sm text-muted-foreground">
        Anyone with this link can use the public verify page at <code>/{{ slug }}</code
        >.
      </p>
    </div>

    <Card>
      <CardContent class="flex flex-col items-center gap-4 p-6">
        <img :src="qr" :alt="`QR code for ${publicUrl}`" class="size-60 rounded-lg border" />
        <div class="flex flex-wrap items-center justify-center gap-2">
          <Button size="sm" @click="downloadQr">
            <Icon spec="Download" :size="16" /> Download QR
          </Button>
          <Button size="sm" variant="outline" @click="copyLink">
            <Icon spec="Copy" :size="16" /> Copy link
          </Button>
          <a
            :href="publicUrl"
            target="_blank"
            rel="noopener"
            class="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium hover:bg-accent"
          >
            <Icon spec="ExternalLink" :size="16" /> Open
          </a>
        </div>
      </CardContent>
    </Card>

    <div class="flex items-center gap-2 rounded-md border bg-muted/40 p-3 text-sm">
      <code class="min-w-0 flex-1 truncate">{{ publicUrl }}</code>
      <Button variant="ghost" size="sm" @click="copyLink">Copy</Button>
    </div>
  </div>
</template>
