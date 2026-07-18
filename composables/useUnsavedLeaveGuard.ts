import type { Ref } from 'vue'

/**
 * Prompts before navigating away with unsaved changes. When `isDirty` (and not
 * mid-`saving`), the route leave is cancelled, the intended destination is
 * remembered, and `confirmLeave` flips true — bind it to an `<UnsavedLeaveDialog>`.
 *
 * `proceed()` re-runs navigation to the remembered destination. The page calls it
 * after Discard (dirty now cleared) or Save-and-leave; the re-triggered guard
 * sees a clean state and lets the navigation through, so the user actually lands
 * on the page they originally clicked — instead of being left in place.
 */
export function useUnsavedLeaveGuard(isDirty: Ref<boolean>, saving: Ref<boolean>) {
  const confirmLeave = ref(false)
  const pendingTo = ref<string | null>(null)

  onBeforeRouteLeave((to) => {
    if (isDirty.value && !saving.value) {
      pendingTo.value = to.fullPath
      confirmLeave.value = true
      return false
    }
  })

  function proceed(): void {
    const dest = pendingTo.value
    confirmLeave.value = false
    pendingTo.value = null
    if (dest) navigateTo(dest)
  }

  return { confirmLeave, proceed }
}
