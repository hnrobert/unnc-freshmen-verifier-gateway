interface AuthUser {
  id: number
  email: string
  role: string
}

export interface PasskeyInfo {
  id: number
  nickname: string | null
  deviceType: string | null
  backedUp: boolean
  createdAt: string
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

  // --- Passkeys (WebAuthn) ---
  // Browser-side SimpleWebAuthn is dynamically imported so it stays out of the
  // SSR bundle and only loads in the browser when these are actually called.

  async function listPasskeys(): Promise<PasskeyInfo[]> {
    const res = await $fetch<{ passkeys: PasskeyInfo[] }>('/api/auth/passkey')
    return res.passkeys
  }

  async function addPasskey(): Promise<PasskeyInfo[]> {
    const { startRegistration } = await import('@simplewebauthn/browser')
    const options = await $fetch('/api/auth/passkey/register-options')
    const response = await startRegistration({ optionsJSON: options })
    await $fetch('/api/auth/passkey/register-verify', { method: 'POST', body: response })
    return listPasskeys()
  }

  async function removePasskey(id: number): Promise<PasskeyInfo[]> {
    await $fetch(`/api/auth/passkey/${id}`, { method: 'DELETE' })
    return listPasskeys()
  }

  async function loginWithPasskey(): Promise<void> {
    const { startAuthentication } = await import('@simplewebauthn/browser')
    const options = await $fetch('/api/auth/passkey/login-options')
    const response = await startAuthentication({ optionsJSON: options })
    const res = await $fetch<{ user: AuthUser }>('/api/auth/passkey/login-verify', {
      method: 'POST',
      body: response,
    })
    user.value = res.user
  }

  return { user, login, register, logout, listPasskeys, addPasskey, removePasskey, loginWithPasskey }
}
