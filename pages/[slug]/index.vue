<script setup lang="ts">
import type { AdmissionResult } from '#shared/types'

definePageMeta({ layout: 'default' })
const route = useRoute()
const slug = computed(() => route.params.slug as string)

// Cross-page skip: if this browser already earned a device-bound verify JWT (in
// any page), jump straight to THIS page's welcome page — no form, no portal call.
// `useRequestFetch()` forwards the cookie header on SSR so /trust sees vg_verify
// + vg_device during server render (no form flash on the redirect).
const { data: trust } = await useAsyncData(`trust:${slug.value}`, () =>
  useRequestFetch()<{ trusted: boolean; admission?: AdmissionResult }>(
    `/api/pages/${slug.value}/trust`,
  ),
)
if (trust.value?.trusted) {
  const { setVerified } = useVerifier()
  setVerified(true, trust.value.admission)
  await navigateTo(`/${slug.value}/welcome`)
}

// Count one page view per real load (client-only; the track endpoint records a
// 'view' event for this page). Fire-and-forget — analytics must never block render.
onMounted(() => {
  $fetch(`/api/pages/${slug.value}/track`, { method: 'POST' }).catch(() => {})
})
</script>

<template>
  <VerifyForm :slug="slug" />
</template>
