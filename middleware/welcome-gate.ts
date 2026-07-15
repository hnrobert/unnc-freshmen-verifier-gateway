// Gate: only let visitors reach /:slug/welcome (or /:slug/demo/welcome) if they
// verified this session. Runs on BOTH server and client — on SSR there is no
// sessionStorage so isVerified is always false, blocking direct URL access (the
// welcome content is never sent). Client-side navigation after verify passes.
export default defineNuxtRouteMiddleware((to) => {
  const slug = to.params.slug as string
  const { isVerified } = useVerifier()
  if (!isVerified.value) {
    const isDemo = to.path.includes('/demo/')
    return navigateTo(isDemo ? `/${slug}/demo` : `/${slug}`)
  }
})
