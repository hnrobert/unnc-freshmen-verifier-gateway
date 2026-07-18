<script setup lang="ts">
defineProps<{ open: boolean; saving?: boolean }>()
defineEmits<{ stay: []; discard: []; save: [] }>()
</script>

<template>
  <Transition name="fade">
    <div
      v-if="open"
      class="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4"
      @click.self="$emit('stay')"
    >
      <Card class="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Unsaved changes</CardTitle>
          <CardDescription>Save or discard before leaving?</CardDescription>
        </CardHeader>
        <CardContent class="flex gap-2">
          <Button variant="outline" class="flex-1" @click="$emit('stay')">Stay</Button>
          <Button variant="outline" class="flex-1" :disabled="saving" @click="$emit('discard')"
            >Discard</Button
          >
          <Button class="flex-1" :disabled="saving" @click="$emit('save')">Save &amp; leave</Button>
        </CardContent>
      </Card>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
