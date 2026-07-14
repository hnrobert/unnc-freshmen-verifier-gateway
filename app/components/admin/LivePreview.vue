<script setup lang="ts">
import type { AdmissionResult } from '#shared/types'

const screen = ref<'verify' | 'welcome'>('verify')
const stubAdmission: AdmissionResult = {
  ok: true,
  admitted: true,
  message: 'preview',
  name: '张三',
  university: '宁波诺丁汉大学',
  date: '2026-08-15',
  detail: '已录取',
}
</script>

<template>
  <div class="sticky top-4">
    <div class="mb-2 flex items-center gap-2">
      <span class="text-sm font-medium text-muted-foreground">Live preview</span>
      <div class="ml-auto flex gap-1">
        <Button size="sm" :variant="screen === 'verify' ? 'default' : 'outline'" @click="screen = 'verify'">Verify</Button>
        <Button size="sm" :variant="screen === 'welcome' ? 'default' : 'outline'" @click="screen = 'welcome'">Welcome</Button>
      </div>
    </div>
    <div class="overflow-hidden rounded-lg border bg-background shadow-sm">
      <div class="max-h-[70vh] overflow-auto">
        <VerifyForm v-if="screen === 'verify'" slug="" preview />
        <WelcomeContent v-else :stub-admission="stubAdmission" />
      </div>
    </div>
  </div>
</template>
