// UX gate: only let visitors reach /:slug/welcome if they verified this session.
// Client-only (the welcome content is in the bundle regardless — not a security boundary).
export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.client) {
    const slug = to.params.slug as string
    const { isVerified } = useVerifier()
    if (!isVerified.value) return navigateTo(`/${slug}`)
  }
})
