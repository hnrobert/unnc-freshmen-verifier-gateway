<script setup lang="ts">
import defaultConfig from '~/shared/lib/defaultConfig'

const props = defineProps<{
  label: string
  locales: string[]
  messages: Record<string, unknown>
  path: string
}>()

const defaultMsgs = defaultConfig.messages as Record<string, unknown>

function getPath(locale: string): string {
  return props.path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), props.messages[locale]) as string ?? ''
}

function getDefaultPath(locale: string): string {
  return props.path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), defaultMsgs[locale]) as string ?? ''
}

/**
 * If the stored value matches the default, clear it so the input shows the
 * default as a placeholder (greyed out). Only non-default values are stored.
 */
function displayValue(locale: string): string {
  const val = getPath(locale)
  const def = getDefaultPath(locale)
  return val === def ? '' : val
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
  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
    <div v-if="locales.includes('zh')" class="grid gap-1.5">
      <Label>{{ label }} <span class="text-xs text-muted-foreground">zh</span></Label>
      <Input
        :model-value="displayValue('zh')"
        :placeholder="getDefaultPath('zh')"
        @update:model-value="setPath('zh', String($event))"
      />
    </div>
    <div v-if="locales.includes('en')" class="grid gap-1.5">
      <Label>{{ label }} <span class="text-xs text-muted-foreground">en</span></Label>
      <Input
        :model-value="displayValue('en')"
        :placeholder="getDefaultPath('en')"
        @update:model-value="setPath('en', String($event))"
      />
    </div>
  </div>
</template>
