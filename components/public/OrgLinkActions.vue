<script setup lang="ts">
import { buttonVariants } from '~/components/ui/button'

const props = withDefaults(
  defineProps<{ slug: string; variant?: 'ghost' | 'outline'; size?: 'sm' | 'default' }>(),
  { variant: 'ghost', size: 'sm' },
)

const open = ref(false)
const qrDataUrl = ref('')
// Origin is only known client-side; build the absolute URL after mount so the
// QR encodes a real, scannable link (SSR has no window).
const origin = ref('')
onMounted(() => {
  origin.value = window.location.origin
})
const url = computed(() => `${origin.value}/${props.slug}`)

async function copyLink() {
  try {
    await navigator.clipboard.writeText(url.value)
    toast.success('Link copied')
  } catch {
    toast.error('Could not copy link')
  }
}

async function openQr() {
  open.value = true
  if (!qrDataUrl.value) {
    const QRCode = (await import('qrcode')).default
    qrDataUrl.value = await QRCode.toDataURL(url.value, { margin: 1, width: 256 })
  }
}
</script>

<template>
  <div class="flex items-center gap-1">
    <Button
      :size="props.size"
      :variant="props.variant"
      class="px-2"
      title="Copy link"
      @click="copyLink"
    >
      <Icon spec="Copy" :size="15" />
    </Button>
    <Button
      :size="props.size"
      :variant="props.variant"
      class="px-2"
      title="QR code"
      @click="openQr"
    >
      <Icon spec="QrCode" :size="15" />
    </Button>

    <Transition name="fade">
      <div
        v-if="open"
        class="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4"
        @click.self="open = false"
      >
        <Card class="w-full max-w-xs">
          <CardHeader>
            <CardTitle class="text-base">Link to /{{ props.slug }}</CardTitle>
          </CardHeader>
          <CardContent class="flex flex-col items-center gap-3">
            <img
              v-if="qrDataUrl"
              :src="qrDataUrl"
              alt="QR code"
              class="size-48 rounded-lg bg-white p-2"
            />
            <div v-else class="size-48 animate-pulse rounded-lg bg-muted"></div>
            <code class="w-full truncate rounded bg-muted px-2 py-1 text-center text-xs">{{
              url
            }}</code>
            <div class="flex w-full gap-2">
              <Button class="flex-1" @click="copyLink"><Icon spec="Copy" :size="16" /> Copy</Button>
              <a
                :href="qrDataUrl"
                :download="`${props.slug}-qr.png`"
                :class="buttonVariants({ variant: 'outline' })"
                class="flex flex-1 items-center justify-center"
                ><Icon spec="Download" :size="16"
              /></a>
              <Button variant="outline" @click="open = false">Close</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
