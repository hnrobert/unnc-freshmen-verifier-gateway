/**
 * Reactive, session-scoped verification state. Backed by `sessionStorage` so a
 * verified visitor stays on the welcome page across reloads within the tab, but
 * must re-verify after closing it. Also carries the portal-returned admission
 * details so the welcome page can show them.
 *
 * NOTE: this is a UX gate for a static site, not an access-control boundary —
 * the welcome content is necessarily present in the bundle. See README.
 */
import { computed, ref } from 'vue'
import type { AdmissionResult } from '#shared/types'

const VERIFIED_KEY = 'unnc-vg.verified'
const DETAILS_KEY = 'unnc-vg.details'

const hasStorage = typeof sessionStorage !== 'undefined'
const verified = ref(hasStorage && sessionStorage.getItem(VERIFIED_KEY) === '1')
const admission = ref<AdmissionResult | null>(null)

// Restore admission details on first load if already verified this session.
if (verified.value && hasStorage) {
  try {
    const raw = sessionStorage.getItem(DETAILS_KEY)
    if (raw) admission.value = JSON.parse(raw) as AdmissionResult
  } catch {
    /* ignore malformed cache */
  }
}

export function useVerifier() {
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
      /* sessionStorage may be unavailable (private mode); fall back to in-memory. */
    }
  }

  function reset(): void {
    setVerified(false)
  }

  return { isVerified, admission, setVerified, reset }
}
