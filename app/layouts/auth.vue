<template>
  <div class="relative flex min-h-screen items-center justify-center bg-background p-4">
    <div aria-hidden="true" class="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div class="absolute -top-40 left-1/2 size-[42rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"></div>
    </div>
    <div class="w-full max-w-sm">
      <div class="mb-6 flex items-center justify-center gap-2 text-lg font-semibold">
        <span class="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10 12 5 2 10l10 5 10-5Z" /><path d="M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5" /></svg>
        </span>
        <span>UNNC Verifier</span>
      </div>
      <slot />
    </div>
  </div>
</template>
