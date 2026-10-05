<script setup lang="ts">
import { useToast } from '@/composables/useToast.ts'
import TechIcon from '@/components/TechIcon.vue'

const { toasts, dismiss } = useToast()

const iconMap = {
  success: 'check-circle',
  error: 'shield-alert',
  warning: 'alert-triangle',
  info: 'activity',
}
</script>

<template>
  <div class="toast-container" aria-live="polite">
    <TransitionGroup name="toast-slide">
      <div
        v-for="item in toasts"
        :key="item.id"
        class="toast-item"
        :class="item.type"
        role="status"
      >
        <span class="toast-icon">
          <TechIcon :name="iconMap[item.type] || 'activity'" :size="16" />
        </span>
        <span class="toast-msg">{{ item.message }}</span>
        <button class="toast-close" type="button" @click="dismiss(item.id)">
          &times;
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-container {
  position: fixed;
  top: calc(var(--topbar) + 16px);
  right: 24px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  pointer-events: none;
}

.toast-item {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  min-width: 260px;
  max-width: 440px;
  padding: 10px 14px;
  border-radius: var(--r);
  background: var(--surface);
  border: 1px solid var(--line-strong);
  box-shadow: var(--shadow-pop);
  font-size: var(--fs-13);
  color: var(--text-strong);
  backdrop-filter: blur(8px);
}

.toast-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.toast-msg {
  flex: 1;
  line-height: var(--lh-snug);
  word-break: break-word;
}

.toast-close {
  background: transparent;
  border: none;
  color: var(--text-mute);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 2px 4px;
  border-radius: 2px;
  transition: color var(--dur-fast);
}

.toast-close:hover {
  color: var(--text-strong);
}

.toast-item.success {
  border-color: var(--jade);
}
.toast-item.success .toast-icon {
  color: var(--jade);
}

.toast-item.error {
  border-color: var(--cinnabar);
}
.toast-item.error .toast-icon {
  color: var(--cinnabar);
}

.toast-item.warning {
  border-color: var(--amber);
}
.toast-item.warning .toast-icon {
  color: var(--amber);
}

.toast-item.info {
  border-color: var(--brand);
}
.toast-item.info .toast-icon {
  color: var(--brand);
}

.toast-slide-enter-active,
.toast-slide-leave-active {
  transition: all 0.24s cubic-bezier(0.16, 1, 0.3, 1);
}

.toast-slide-enter-from {
  opacity: 0;
  transform: translateX(30px) scale(0.96);
}

.toast-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.95);
}
</style>
