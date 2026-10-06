<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'ghost' | 'danger' | 'subtle'
    size?: 'sm' | 'md' | 'lg'
    block?: boolean
    loading?: boolean
  }>(),
  { variant: 'primary', size: 'md', block: false, loading: false }
)
</script>

<template>
  <button
    class="nb"
    :class="[`nb-${variant}`, `nb-${size}`, { 'nb-block': block, 'nb-loading': loading }]"
    :disabled="loading"
  >
    <span class="nb-glow" aria-hidden="true"></span>
    <span class="nb-content"><slot /></span>
  </button>
</template>

<style scoped>
.nb {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
  border-radius: var(--r);
  font-weight: var(--fw-semibold);
  letter-spacing: -0.015em;
  transition: all var(--dur) var(--ease);
  overflow: hidden;
  white-space: nowrap;
  user-select: none;
  cursor: pointer;
}
.nb:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  filter: grayscale(30%);
}
.nb:focus-visible {
  outline: 2px solid var(--brand-bright);
  outline-offset: 3px;
}

.nb-sm {
  height: 32px;
  padding: 0 14px;
  font-size: var(--fs-12);
  border-radius: var(--r-sm);
}
.nb-md {
  height: 40px;
  padding: 0 18px;
  font-size: var(--fs-13);
  border-radius: var(--r);
}
.nb-lg {
  height: 48px;
  padding: 0 24px;
  font-size: var(--fs-15, 15px);
  border-radius: var(--r-lg);
}

.nb-content {
  position: relative;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
}

/* 主按钮：流光高光晶体 + 悬停强环境光晕 */
.nb-primary {
  background: linear-gradient(135deg, #4f46e5 0%, #6366f1 50%, #4338ca 100%);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.25);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.4),
    0 4px 15px rgba(79, 70, 229, 0.45);
}
.nb-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.5),
    0 8px 25px rgba(79, 70, 229, 0.65),
    0 0 15px rgba(99, 102, 241, 0.5);
}
.nb-primary:active:not(:disabled) {
  transform: translateY(0);
}

/* 幽灵磨砂毛玻璃按钮 */
.nb-ghost {
  background: var(--surface);
  color: var(--text-strong);
  border: 1px solid var(--line);
  box-shadow: var(--shadow-card);
  backdrop-filter: blur(16px);
}
.nb-ghost:hover:not(:disabled) {
  background: var(--surface-2);
  border-color: var(--line-strong);
  color: #fff;
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
}

/* 告警按钮 */
.nb-danger {
  background: rgba(244, 63, 94, 0.15);
  color: #fb7185;
  border: 1px solid rgba(244, 63, 94, 0.35);
  box-shadow: 0 2px 10px rgba(244, 63, 94, 0.2);
}
.nb-danger:hover:not(:disabled) {
  background: #f43f5e;
  color: #ffffff;
  box-shadow: 0 6px 20px rgba(244, 63, 94, 0.5);
  transform: translateY(-2px);
}

.nb-subtle {
  background: transparent;
  color: var(--text-mute);
  border: 1px solid transparent;
}
.nb-subtle:hover:not(:disabled) {
  color: var(--text-strong);
  background: var(--surface-2);
  border-color: var(--line);
}

.nb-loading { pointer-events: none; }
.nb-loading .nb-content::after {
  content: "";
  width: 0.85em;
  height: 0.85em;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
</style>
