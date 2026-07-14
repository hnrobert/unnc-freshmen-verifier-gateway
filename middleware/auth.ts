// Protect pages: bounce to /login if not authenticated.
export default defineNuxtRouteMiddleware((to) => {
  const user = useState<{ id: string; email: string } | null>('user')
  if (!user.value) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }
})
