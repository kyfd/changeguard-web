<script setup lang="ts">
import { PASSPORT_STEPS, stepIndex, passportStepLabel } from '@/lib/labels.ts'

defineProps<{
  status: string
}>()
</script>

<template>
  <ol class="passport-steps">
    <li
      v-for="(s, i) in PASSPORT_STEPS"
      :key="s.key"
      class="passport-step-item"
      :class="{
        'is-current': i === stepIndex(status),
        'is-done': i < stepIndex(status),
      }"
    >
      <div class="step-badge mono">
        <span v-if="i < stepIndex(status)" class="step-check">&#10003;</span>
        <span v-else>{{ String(i + 1).padStart(2, '0') }}</span>
      </div>
      <span class="step-text">{{ passportStepLabel(s.key, status, s.label) }}</span>
      <span v-if="i < PASSPORT_STEPS.length - 1" class="step-connector" aria-hidden="true"></span>
    </li>
  </ol>
</template>

<style scoped>
.passport-steps {
  display: flex;
  align-items: center;
  justify-content: space-between;
  list-style: none;
  padding: var(--sp-4) var(--sp-5);
  margin: 0 0 var(--sp-6) 0;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-xl);
  overflow-x: auto;
  gap: var(--sp-3);
}

.passport-step-item {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  flex: 1;
  min-width: 140px;
  position: relative;
}

.step-badge {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--fs-11);
  font-weight: var(--fw-semibold);
  background: var(--surface-2);
  color: var(--text-faint);
  border: 1px solid var(--line-strong);
  flex-shrink: 0;
  transition: all var(--dur-fast);
}

.step-check {
  font-size: 11px;
}

.step-text {
  font-size: var(--fs-13);
  font-weight: var(--fw-medium);
  color: var(--text-mute);
  white-space: nowrap;
}

.step-connector {
  flex: 1;
  height: 2px;
  background: var(--line);
  margin-left: var(--sp-2);
}

.passport-step-item.is-done .step-badge {
  background: var(--brand-soft);
  color: var(--brand);
  border-color: var(--brand);
}

.passport-step-item.is-done .step-text {
  color: var(--text);
}

.passport-step-item.is-done .step-connector {
  background: var(--brand);
}

.passport-step-item.is-current .step-badge {
  background: var(--brand);
  color: #fff;
  border-color: var(--brand-deep);
  box-shadow: 0 0 0 3px var(--brand-soft);
}

.passport-step-item.is-current .step-text {
  color: var(--text-strong);
  font-weight: var(--fw-semibold);
}
</style>
