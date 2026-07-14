// UX gate: only let visitors reach /:slug/welcome (or /:slug/demo/welcome) if
// they verified this session. Client-only (welcome content is in the bundle —
// not a security boundary). Redirects to the matching verify/demo page.
export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.client) {
    const slug = to.params.slug as string
    const { isVerified } = useVerifier()
    if (!isVerified.value) {
      const isDemo = to.path.includes('/demo/')
      return navigateTo(isDemo ? `/${slug}/demo` : `/${slug}`)
    }
  }
})
