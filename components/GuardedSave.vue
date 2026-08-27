<script setup lang="ts">
/**
 * GuardedSave — the site-wide "modify & save" affordance, all of it in one
 * component: the sticky bottom save/discard bar, the unsaved-changes leave
 * dialog, and the saving/saved lifecycle around the page's save function.
 *
 * Usage:
 *   <GuardedSave :dirty="isDirty" :on-save="onSave" :on-discard="onDiscard" />
 *
 * `onSave` may be async; GuardedSave wraps it — saving state, disabling the
 * buttons while in flight, flashing "✓ Saved" for 2s on success. Return
 * `false` from onSave to suppress the flash when the page handled an error
 * itself (toast); thrown errors also suppress it. `onDiscard` resets the
 * draft (synchronous). A spacer keeps the fixed bar from covering page
 * content, so pages no longer need their own pb-24.
 */
const props = defineProps<{
  dirty: boolean
  /** Bound as :on-save in templates (kebab → camel). */
  onSave: () => Promise<boolean | void> | boolean | void
  /** Bound as :on-discard in templates. */
  onDiscard: () => void
}>()

/** Optional two-way saving state — bind `v-model:saving` when the page needs
 * to disable its inputs while the save is in flight. */
const saving = defineModel<boolean>('saving', { default: false })
const saved = ref(false)

const { confirmLeave, proceed } = useUnsavedLeaveGuard(
  computed(() => props.dirty),
  saving,
)

async function save(): Promise<void> {
  if (saving.value) return
  saving.value = true
  saved.value = false
  try {
    const ok = await props.onSave()
    if (ok !== false) {
      saved.value = true
      setTimeout(() => (saved.value = false), 2000)
    }
  } catch {
    /* the page's onSave reports its own errors — no flash */
  } finally {
    saving.value = false
  }
}

async function saveAndProceed(): Promise<void> {
  await save()
  proceed()
}
</script>

<template>
  <!-- Spacer: the bar is fixed — keep it from covering page content. -->
  <div v-if="dirty || saved" class="h-20" aria-hidden="true"></div>

  <SaveBar :dirty="dirty" :saving="saving" :saved="saved" @save="save" @discard="onDiscard" />

  <UnsavedLeaveDialog
    :open="confirmLeave"
    :saving="saving"
    @stay="confirmLeave = false"
    @discard="
      () => {
        onDiscard()
        proceed()
      }
    "
    @save="saveAndProceed"
  />
</template>
