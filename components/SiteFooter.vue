<script setup lang="ts">
const year = new Date().getFullYear()
const REPO = 'https://github.com/hnrobert/unnc-freshmen-verifier-gateway'
</script>

<template>
  <footer class="mt-[1vh] px-4 py-4 text-center text-xs text-muted-foreground">
    <div class="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1">
      <span>© {{ year }} UNNC Freshmen Verifier Gateway</span>
      <span aria-hidden="true">·</span>
      <a
        :href="`${REPO}/blob/main/LICENSE`"
        target="_blank"
        rel="noopener noreferrer"
        class="underline-offset-2 hover:underline"
        >Apache-2.0</a
      >
      <span aria-hidden="true">·</span>
      <a
        :href="REPO"
        target="_blank"
        rel="noopener noreferrer"
        class="underline-offset-2 hover:underline"
        >GitHub</a
      >
    </div>
    <div class="mt-1">
      Made with heart by
      <a
        href="https://github.com/hnrobert"
        target="_blank"
        rel="noopener noreferrer"
        class="underline-offset-2 hover:underline"
        >Robert He</a
      >
    </div>
  </footer>
</template>
