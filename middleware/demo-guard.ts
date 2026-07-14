// Protect demo routes: only the org owner can access /<slug>/demo/*.
// Requires auth + ownership (verified by calling the owner-only config endpoint).
export default defineNuxtRouteMiddleware(async (to) => {
  const slug = to.params.slug as string
  const user = useState<{ id: string; email: string } | null>('user')

  if (!user.value) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }

  // Verify ownership by hitting the owner-only config endpoint.
  // Forward the session cookie on SSR so the server recognizes the user.
  try {
    const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
    await $fetch(`/api/orgs/${slug}/config`, { query: { edit: 1 }, headers })
  } catch {
    return navigateTo('/dashboard')
  }
})
