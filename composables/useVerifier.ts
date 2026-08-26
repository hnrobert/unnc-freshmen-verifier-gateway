/**
 * Reactive, session-scoped verification state. Backed by `sessionStorage` so a
 * verified visitor stays on the welcome page across reloads within the tab, but
 * must re-verify after closing it. Also carries the portal-returned admission
 * details so the welcome page can show them.
 *
 * The refs live in `useState` — NOT plain module refs. Module refs are shared
 * across every SSR request on the server, so one visitor's verify would mark
 * every later visitor verified during their render (a real cross-request
 * leak). useState is per-request on the server AND transfers to the client in
 * the payload, which also means an SSR fast-path (trust-cookie redirect)
 * hydrates as verified instead of bouncing back to the form.
 *
 * NOTE: this is a UX gate for a static site, not an access-control boundary —
 * the welcome content is necessarily present in the bundle. See README.
 */
import type { AdmissionResult } from '#shared/types'

const VERIFIED_KEY = 'unnc-vg.verified'
const DETAILS_KEY = 'unnc-vg.details'

// Restore the tab-session state on the client (no-op on the server, where
// useState starts fresh each request).
const hasStorage = typeof sessionStorage !== 'undefined'

export function useVerifier() {
  const verified = useState<boolean>('unnc-vg.verified-state', () => {
    try {
      return hasStorage && sessionStorage.getItem(VERIFIED_KEY) === '1'
    } catch {
      return false
    }
  })
  const admission = useState<AdmissionResult | null>('unnc-vg.admission-state', () => {
    try {
      if (!hasStorage || sessionStorage.getItem(VERIFIED_KEY) !== '1') return null
      const raw = sessionStorage.getItem(DETAILS_KEY)
      return raw ? (JSON.parse(raw) as AdmissionResult) : null
    } catch {
      return null
    }
  })

  const isVerified = computed(() => verified.value)

  function setVerified(value: boolean, details?: AdmissionResult): void {
    verified.value = value
    admission.value = details ?? null
    try {
      if (value) {
        sessionStorage.setItem(VERIFIED_KEY, '1')
        if (details) sessionStorage.setItem(DETAILS_KEY, JSON.stringify(details))
        else sessionStorage.removeItem(DETAILS_KEY)
      } else {
        sessionStorage.removeItem(VERIFIED_KEY)
        sessionStorage.removeItem(DETAILS_KEY)
      }
    } catch {
      /* sessionStorage may be unavailable (private mode); in-memory state still holds. */
    }
  }

  function reset(): void {
    setVerified(false)
  }

  return { isVerified, admission, setVerified, reset }
}
