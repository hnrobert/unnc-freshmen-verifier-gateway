/** Shared auth form state — persists when switching between login and register. */
export function useAuthForm() {
  const email = useState<string>('auth-email', () => '')
  const password = useState<string>('auth-password', () => '')
  const confirm = useState<string>('auth-confirm', () => '')
  return { email, password, confirm }
}
