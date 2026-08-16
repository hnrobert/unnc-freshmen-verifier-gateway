<script setup lang="ts">
import { REMINDER_SLOTS, type ReminderSlot } from '#shared/types'

/**
 * Shared editor for a reminder preference triplet: master on/off, which days
 * (REMINDER_SLOTS), and a time-of-day. `v-model` over the whole object so both
 * the account Settings card and the per-page Notifications tab reuse it. The
 * timezone is account-level, so it is NOT part of this component.
 */
interface PrefState {
  enabled: boolean
  slots: ReminderSlot[]
  time: string
}
const props = defineProps<{ modelValue: PrefState; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [PrefState] }>()

const SLOT_LABELS: Record<ReminderSlot, string> = {
  '-3d': '3 days before',
  '-2d': '2 days before',
  '-1d': '1 day before',
  'day-of': 'On the day',
}

function update(patch: Partial<PrefState>): void {
  emit('update:modelValue', { ...props.modelValue, ...patch })
}
function toggleEnabled(e: Event): void {
  update({ enabled: (e.target as HTMLInputElement).checked })
}
function slotChecked(slot: ReminderSlot): boolean {
  return props.modelValue.slots.includes(slot)
}
function toggleSlot(slot: ReminderSlot, e: Event): void {
  const checked = (e.target as HTMLInputElement).checked
  const arr = [...props.modelValue.slots]
  const i = arr.indexOf(slot)
  if (checked && i < 0) arr.push(slot)
  if (!checked && i >= 0) arr.splice(i, 1)
  update({ slots: arr })
}
function onTime(e: Event): void {
  update({ time: (e.target as HTMLInputElement).value })
}
</script>

<template>
  <div class="space-y-3">
    <label class="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        class="size-4 shrink-0"
        style="accent-color: var(--primary)"
        :checked="modelValue.enabled"
        :disabled="disabled"
        @change="toggleEnabled"
      />
      <span>Send me expiry reminder emails</span>
    </label>

    <div v-if="modelValue.enabled" class="space-y-3 pl-6">
      <div>
        <span class="text-sm">Remind me</span>
        <div class="mt-1 grid grid-cols-2 gap-2">
          <label v-for="slot in REMINDER_SLOTS" :key="slot" class="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              class="size-4 shrink-0"
              style="accent-color: var(--primary)"
              :checked="slotChecked(slot)"
              :disabled="disabled"
              @change="toggleSlot(slot, $event)"
            />
            <span>{{ SLOT_LABELS[slot] }}</span>
          </label>
        </div>
      </div>

      <label class="flex items-center gap-2 text-sm">
        <span class="shrink-0">At</span>
        <input
          type="time"
          class="rounded-md border bg-background px-2 py-1 text-sm"
          :value="modelValue.time"
          :disabled="disabled"
          @change="onTime"
        />
        <span class="text-xs text-muted-foreground">your local time</span>
      </label>
    </div>
  </div>
</template>
