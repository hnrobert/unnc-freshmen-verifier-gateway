// Keep logged-in users out of /login and /register.
export default defineNuxtRouteMiddleware(() => {
  const user = useState<{ id: number; email: string; role: string } | null>('user')
  if (user.value) return navigateTo('/dashboard')
})
