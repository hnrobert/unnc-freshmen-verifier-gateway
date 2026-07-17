export default defineNuxtRouteMiddleware(() => {
  const user = useState<{ role: string } | null>('user')
  if (user.value?.role !== 'superadmin') {
    return navigateTo('/dashboard')
  }
})
