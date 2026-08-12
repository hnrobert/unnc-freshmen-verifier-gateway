<script setup lang="ts">
/**
 * Thin wrapper over the packaged `email-poster/vue` editor.
 *
 * All editor logic — presets, 13-field mapping, body XOR, live preview, detect,
 * import/export — now lives in the email-poster package and is reusable across
 * projects. This wrapper only forwards v-model + disabled, skins the editor to
 * the gateway's shadcn theme via --ep-* CSS vars (see <style> below), and wires
 * the editor's events to vue-sonner toasts.
 *
 * The parent (mail.vue) and server-side FieldMapSchema validation are unchanged.
 * Server/runtime imports keep using `email-poster` (root) or `email-poster/pure`
 * as before; only the browser-side editor comes from `email-poster/vue`.
 */
import { MailInterfaceEditor, type FieldMap } from 'email-poster/vue'
import { toast } from 'vue-sonner'

defineProps<{ modelValue: FieldMap; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [FieldMap] }>()

function onUpdate(v: FieldMap): void {
  emit('update:modelValue', v)
}
function onToast(e: { message: string }): void {
  toast.success(e.message)
}
function onError(e: { message: string }): void {
  toast.error(e.message)
}
</script>

<template>
  <MailInterfaceEditor
    :model-value="modelValue"
    :disabled="disabled"
    @update:model-value="onUpdate"
    @detected="onToast"
    @imported="onToast"
    @error="onError"
  />
</template>

<!--
  Skin the packaged editor to this project's shadcn theme. The editor defines
  slate-gray defaults on :where(.ep-editor) (zero specificity); this rule wins
  (specificity 0,1,0) and — because it references theme tokens that .dark
  redefines — adapts to dark mode automatically. Only the tokens that matter for
  theme coherence are remapped; layout/spacing defaults are kept.
-->
<style>
.ep-editor {
  --ep-color-fg: var(--foreground);
  --ep-color-muted-fg: var(--muted-foreground);
  --ep-color-subtle-fg: var(--muted-foreground);
  --ep-color-border: var(--border);
  --ep-color-muted-bg: var(--muted);
  --ep-color-primary: var(--primary);
  --ep-color-primary-fg: var(--primary-foreground);
  --ep-color-primary-border: var(--primary);
  --ep-color-ring: var(--ring);
  --ep-color-destructive: var(--destructive);
  --ep-radius: var(--radius);
  --ep-radius-sm: calc(var(--radius) - 4px);
}
</style>
