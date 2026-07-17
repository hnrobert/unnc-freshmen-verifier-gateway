<script setup lang="ts">
const props = defineProps<{ slug: string; src: string }>()
const resolved = ref('')

watch(() => props.src, (val) => {
  if (!val) { resolved.value = ''; return }
  if (!val.startsWith('img:')) { resolved.value = val; return }
  $fetch<{ mime: string; base64: string }>(`/api/orgs/${props.slug}/img/${val.slice(4)}`)
    .then((res) => { resolved.value = `data:${res.mime};base64,${res.base64}` })
    .catch(() => {})
}, { immediate: true })
</script>

<template>
  <img v-if="resolved" :src="resolved" class="h-32 w-full rounded-lg border" :class="$attrs.class as string" />
</template>
