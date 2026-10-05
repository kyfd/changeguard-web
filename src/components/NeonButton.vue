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
  font-weight: var(--fw-medium);
  letter-spacing: -0.01em;
  transition: all var(--dur-fast) var(--ease);
  overflow: hidden;
  white-space: nowrap;
  user-select: none;
}
.nb:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  filter: grayscale(20%);
}
.nb:focus-visible {
  outline: 2px solid var(--brand-bright);
  outline-offset: 2px;
}

.nb-sm {
  height: 30px;
  padding: 0 var(--sp-3);
  font-size: var(--fs-12);
  border-radius: var(--r-sm);
}
.nb-md {
  height: 36px;
  padding: 0 var(--sp-4);
  font-size: var(--fs-13);
  border-radius: var(--r);
}
.nb-lg {
  height: 44px;
  padding: 0 var(--sp-6);
  font-size: var(--fs-14);
  border-radius: var(--r-lg);
}
.nb-content {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
}

/* 主按钮：电光渐变 + 晶体顶缘微光 + 优雅悬浮浮起 */
.nb-primary {
  background: linear-gradient(135deg, var(--brand) 0%, var(--brand-bright) 100%);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 2px 6px -1px rgba(79, 70, 229, 0.4);
}
.nb-primary:hover:not(:disabled) {
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 4px 14px -2px rgba(79, 70, 229, 0.5);
  transform: translateY(-1px);
}
.nb-primary:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
}

/* 幽灵白透按钮 */
.nb-ghost {
  background: var(--surface);
  color: var(--text-strong);
  border: 1px solid var(--line);
  box-shadow: var(--shadow-card);
}
.nb-ghost:hover:not(:disabled) {
  background: var(--bg-elev);
  border-color: var(--line-strong);
  color: var(--brand);
  transform: translateY(-1px);
}

/* 告警按钮 */
.nb-danger {
  background: var(--cinnabar-soft);
  color: var(--cinnabar);
  border: 1px solid rgba(239, 68, 68, 0.3);
}
.nb-danger:hover:not(:disabled) {
  background: var(--cinnabar);
  color: #ffffff;
  box-shadow: 0 4px 12px -2px rgba(239, 68, 68, 0.4);
  transform: translateY(-1px);
}

/* 简约边框按钮 */
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
