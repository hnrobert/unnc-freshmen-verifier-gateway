import { GuardedSave, SaveBar, UnsavedLeaveDialog } from 'vue-guarded-save'
// Scoped <style> blocks (the savebar/fade slide animations) compiled into the
// package's own css — the gateway's Tailwind scan only covers utility classes.
import 'vue-guarded-save/style.css'

/**
 * Registers the published vue-guarded-save components globally so the pages
 * that previously used the local copies (components/GuardedSave.vue etc.)
 * need zero template changes: `<GuardedSave>` is the full save-bar +
 * leave-guard + saving-lifecycle affordance; `SaveBar` / `UnsavedLeaveDialog`
 * are the lower-level pieces (kept registered for parity).
 */
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.component('GuardedSave', GuardedSave)
  nuxtApp.vueApp.component('SaveBar', SaveBar)
  nuxtApp.vueApp.component('UnsavedLeaveDialog', UnsavedLeaveDialog)
})
