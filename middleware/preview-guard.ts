export default defineNuxtRouteMiddleware(async (to) => {
  const slug = to.params.slug as string
  const user = useState<{ id: number; email: string; role: string } | null>('user')

  if (!user.value) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }

  try {
    const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
    await $fetch(`/api/orgs/${slug}/config`, { query: { edit: 1 }, headers })
  } catch {
    return navigateTo('/dashboard')
  }
})
