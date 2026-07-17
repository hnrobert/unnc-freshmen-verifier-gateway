<script setup lang="ts">
/** A zh-left / en-right labeled input pair. Hides a locale's column if not enabled. */
const props = defineProps<{
  label: string
  locales: string[]
  messages: Record<string, unknown>
  path: string
}>()

function getPath(locale: string): string {
  return props.path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), props.messages[locale]) as string ?? ''
}
function setPath(locale: string, value: string): void {
  const keys = props.path.split('.')
  const last = keys.pop()!
  const obj = keys.reduce<Record<string, unknown>>((o, k) => {
    if (!o[k] || typeof o[k] !== 'object') o[k] = {}
    return o[k] as Record<string, unknown>
  }, props.messages[locale] as Record<string, unknown>)
  obj[last] = value
}
</script>

<template>
  <div class="grid grid-cols-2 gap-3">
    <div v-if="locales.includes('zh')" class="grid gap-1.5">
      <Label>{{ label }} <span class="text-xs text-muted-foreground">zh</span></Label>
      <Input :model-value="getPath('zh')" @update:model-value="setPath('zh', String($event))" />
    </div>
    <div v-if="locales.includes('en')" class="grid gap-1.5">
      <Label>{{ label }} <span class="text-xs text-muted-foreground">en</span></Label>
      <Input :model-value="getPath('en')" @update:model-value="setPath('en', String($event))" />
    </div>
  </div>
</template>
