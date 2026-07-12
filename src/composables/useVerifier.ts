/**
 * Reactive, session-scoped verification state. Backed by `sessionStorage` so a
 * verified visitor stays on the welcome page across reloads within the tab, but
 * must re-verify after closing it.
 *
 * NOTE: this is a UX gate for a static site, not an access-control boundary —
 * the welcome content is necessarily present in the bundle. See README.
 */
import { computed, ref } from 'vue'

const STORAGE_KEY = 'unnc-vg.verified'
const verified = ref(typeof sessionStorage !== 'undefined' && sessionStorage.getItem(STORAGE_KEY) === '1')

export function useVerifier() {
  const isVerified = computed(() => verified.value)

  function setVerified(value: boolean): void {
    verified.value = value
    try {
      if (value) sessionStorage.setItem(STORAGE_KEY, '1')
      else sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      /* sessionStorage may be unavailable (private mode); fall back to in-memory. */
    }
  }

  function reset(): void {
    setVerified(false)
  }

  return { isVerified, setVerified, reset }
}
