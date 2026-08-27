import type { AdmissionResult } from '#shared/types'

// Gate: only let visitors reach /:slug/welcome (or /:slug/preview/welcome) if
// they verified this session — OR carry a still-valid device-bound trust
// cookie (vg_verify). The sessionStorage flag alone bounces returning trusted
// visitors: on a fresh page load it's set only server-side (SSR fast-path),
// so the client-side hydration of this middleware sees it empty and would
// redirect them back to the form. The /trust check bridges that: when the
// cookie validates (device fingerprint included), the visitor passes and the
// session flag is re-seeded.
export default defineNuxtRouteMiddleware(async (to) => {
  const slug = to.params.slug as string
  const { isVerified, setVerified } = useVerifier()
  if (isVerified.value) return

  interface TrustResult {
    trusted: boolean
    admission?: AdmissionResult
  }
  // Server: useRequestFetch forwards the cookie header on SSR so vg_verify +
  // vg_device are seen during the server-render pass. Client: plain $fetch
  // (cookies ride along). Two separate call sites — unioning the two typed
  // fetchers overflows the compiler.
  let trust: TrustResult | null = null
  try {
    trust = import.meta.server
      ? await useRequestFetch()<TrustResult>(`/api/pages/${slug}/trust`)
      : await $fetch<TrustResult>(`/api/pages/${slug}/trust`)
  } catch {
    trust = null
  }

  if (trust?.trusted) {
    setVerified(true, trust.admission)
    return
  }

  const isDemo = to.path.split('/').filter(Boolean)[1] === 'preview'
  return navigateTo(isDemo ? `/${slug}/preview` : `/${slug}`)
})
