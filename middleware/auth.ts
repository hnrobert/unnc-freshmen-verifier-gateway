export default defineNuxtRouteMiddleware((to) => {
  const user = useState<{ id: number; email: string; role: string } | null>('user')
  if (!user.value) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }
})
