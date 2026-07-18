<template>
  <div class="relative flex min-h-screen items-center justify-center bg-background p-4">
    <div aria-hidden="true" class="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div class="absolute -top-40 left-1/2 size-168 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"></div>
    </div>
    <div class="w-full max-w-sm">
      <div class="mb-6 flex items-center justify-center gap-2 text-lg font-semibold">
        <span class="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Icon spec="GraduationCap" :size="20" />
        </span>
        <span>UNNC Freshmen Verifier Gateway</span>
      </div>
      <slot />
    </div>
  </div>
</template>
