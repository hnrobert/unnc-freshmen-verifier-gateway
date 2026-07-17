interface AuthUser {
  id: number
  email: string
  role: string
}

export function useAuth() {
  const user = useState<AuthUser | null>('user', () => null)

  async function login(email: string, password: string): Promise<void> {
    const res = await $fetch<{ user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    })
    user.value = res.user
  }

  async function register(email: string, password: string): Promise<void> {
    const res = await $fetch<{ user: AuthUser }>('/api/auth/register', {
      method: 'POST',
      body: { email, password },
    })
    user.value = res.user
  }

  async function logout(): Promise<void> {
    await $fetch('/api/auth/logout', { method: 'POST' })
    user.value = null
    await navigateTo('/login')
  }

  return { user, login, register, logout }
}
