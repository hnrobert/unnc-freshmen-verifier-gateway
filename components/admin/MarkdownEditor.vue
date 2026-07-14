<script setup lang="ts">
const props = defineProps<{ modelValue: string; locale: string }>()
const emit = defineEmits<{ 'update:modelValue': [string] }>()

function onInput(e: Event): void {
  emit('update:modelValue', (e.target as HTMLTextAreaElement).value)
}
</script>

<template>
  <div class="grid gap-2 md:grid-cols-2">
    <textarea
      :value="modelValue"
      :placeholder="`Markdown (${locale})`"
      class="min-h-[180px] w-full rounded-md border bg-transparent p-3 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      @input="onInput"
    />
    <div class="min-h-[180px] max-h-[360px] overflow-auto rounded-md border p-3">
      <MarkdownView :source="modelValue" />
    </div>
  </div>
</template>
