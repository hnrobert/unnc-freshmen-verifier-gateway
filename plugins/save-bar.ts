import { GuardedSave } from 'vue-guarded-save'
// Scoped <style> blocks (the savebar/fade slide animations) compiled into the
// package's own css — the gateway's Tailwind scan only covers utility classes.
import 'vue-guarded-save/style.css'

/**
 * Register the published GuardedSave globally (components in node_modules
 * can't be auto-imported), so every page uses `<GuardedSave>` with zero
 * imports. Its lower-level pieces (SaveBar, UnsavedLeaveDialog) are internal
 * to it — nothing in the gateway uses them directly, so they aren't
 * registered.
 */
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.component('GuardedSave', GuardedSave)
})
