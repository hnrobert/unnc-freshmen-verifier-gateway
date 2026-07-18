import type { Ref } from 'vue'

/**
 * Prompts before navigating away with unsaved changes. When `isDirty` (and not
 * mid-`saving`), the route leave is cancelled and `confirmLeave` flips true —
 * bind it to an `<UnsavedLeaveDialog>`. The page's dialog actions decide how to
 * resolve it (stay / discard / save); navigation then resumes on the next click
 * once the dirty state is cleared.
 */
export function useUnsavedLeaveGuard(isDirty: Ref<boolean>, saving: Ref<boolean>) {
  const confirmLeave = ref(false)
  onBeforeRouteLeave(() => {
    if (isDirty.value && !saving.value) {
      confirmLeave.value = true
      return false
    }
  })
  return { confirmLeave }
}
