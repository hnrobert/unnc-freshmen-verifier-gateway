interface AuthUser {
  id: number
  email: string
  role: string
}

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
