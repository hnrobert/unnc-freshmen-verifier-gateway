interface AuthUser {
  id: string
  email: string
}

// Populate the shared `user` state on boot. During SSR, forward the browser
// cookie so /api/auth/me can resolve the session.
export default defineNuxtPlugin(async () => {
  const user = useState<AuthUser | null>('user', () => null)
  const headers = useRequestHeaders(['cookie'])
  try {
    const res = await $fetch<{ user: AuthUser }>('/api/auth/me', {
      headers: import.meta.server && headers.cookie ? { cookie: headers.cookie } : undefined,
    })
    user.value = res.user
  } catch {
    user.value = null
  }
})
