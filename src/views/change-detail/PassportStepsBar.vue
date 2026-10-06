<script setup lang="ts">
import { PASSPORT_STEPS, stepIndex, passportStepLabel } from '@/lib/labels.ts'

defineProps<{
  status: string
}>()
</script>

<template>
  <div class="passport-stepper-container">
    <ol class="stepper-list">
      <li
        v-for="(s, i) in PASSPORT_STEPS"
        :key="s.key"
        class="stepper-step"
        :class="{
          'is-current': i === stepIndex(status),
          'is-done': i < stepIndex(status),
        }"
      >
        <div class="step-indicator">
          <div class="indicator-circle mono">
            <span v-if="i < stepIndex(status)" class="check-mark">&#10003;</span>
            <span v-else>{{ String(i + 1).padStart(2, '0') }}</span>
          </div>
          <span class="step-title">{{ passportStepLabel(s.key, status, s.label) }}</span>
        </div>
        <div v-if="i < PASSPORT_STEPS.length - 1" class="step-track" aria-hidden="true">
          <div class="track-fill" :class="{ 'track-active': i < stepIndex(status) }"></div>
        </div>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.passport-stepper-container {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-xl);
  padding: 20px 28px;
  margin-bottom: 24px;
  box-shadow: var(--shadow-card);
}

.stepper-list {
  display: flex;
  align-items: center;
  justify-content: space-between;
  list-style: none;
  margin: 0;
  padding: 0;
  gap: 16px;
}

.stepper-step {
  display: flex;
  align-items: center;
  flex: 1;
  position: relative;
}
.stepper-step:last-child {
  flex: none;
}

.step-indicator {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.indicator-circle {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  background: var(--surface-2);
  color: var(--text-faint);
  border: 1px solid var(--line-strong);
  transition: all var(--dur-fast);
}

.check-mark {
  font-size: 13px;
  font-weight: 800;
}

.step-title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-mute);
  white-space: nowrap;
}

.step-track {
  flex: 1;
  height: 2px;
  background: var(--line);
  margin: 0 16px;
  position: relative;
  overflow: hidden;
  border-radius: 1px;
}

.track-fill {
  width: 0%;
  height: 100%;
  background: var(--brand);
  transition: width 0.3s ease;
}
.track-fill.track-active {
  width: 100%;
}

/* 已完成状态 */
.stepper-step.is-done .indicator-circle {
  background: rgba(16, 185, 129, 0.12);
  color: var(--jade);
  border-color: rgba(16, 185, 129, 0.4);
}
.stepper-step.is-done .step-title {
  color: var(--text);
}

/* 当前进行中状态 */
.stepper-step.is-current .indicator-circle {
  background: var(--brand);
  color: #ffffff;
  border-color: var(--brand-deep);
  box-shadow: 0 0 0 4px var(--brand-soft), 0 2px 8px rgba(79, 70, 229, 0.3);
}
.stepper-step.is-current .step-title {
  color: var(--text-strong);
  font-weight: 700;
}

@media (max-width: 900px) {
  .passport-stepper-container {
    overflow-x: auto;
    padding: 16px 20px;
  }
  .stepper-step {
    min-width: 140px;
  }
}
</style>
