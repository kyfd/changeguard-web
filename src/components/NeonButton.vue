<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'primary' | 'ghost' | 'danger' | 'subtle'
  size?: 'sm' | 'md' | 'lg'
  block?: boolean
  loading?: boolean
}>(), { variant: 'primary', size: 'md', block: false, loading: false })
</script>

<template>
  <button class="nb" :class="[`nb-${variant}`, `nb-${size}`, { 'nb-block': block, 'nb-loading': loading }]" :disabled="loading">
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
  letter-spacing: 0;
  transition: background var(--dur) var(--ease), border-color var(--dur) var(--ease), color var(--dur) var(--ease);
  overflow: hidden;
  white-space: nowrap;
}
.nb:disabled { opacity: 0.58; cursor: not-allowed; }
.nb:focus-visible { outline: 1px solid var(--brand); outline-offset: 2px; }
/* 固定高度而非 padding 撑开：同一行里的按钮/输入框/选择器必须严格等高 */
.nb-sm { height: 28px; padding: 0 var(--sp-3); font-size: var(--fs-12); }
.nb-md { height: 32px; padding: 0 var(--sp-4); font-size: var(--fs-13); }
.nb-lg { height: 44px; padding: 0 var(--sp-5); font-size: 0.95rem; }
.nb-content { display: inline-flex; align-items: center; gap: var(--sp-2); }

/* 主按钮：实心品牌色 + 顶缘高光，无扫光无渐变 */
.nb-primary {
  background: var(--brand);
  color: #fff;
  border: 1px solid var(--brand-deep);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12);
  transition: background var(--dur) var(--ease), border-color var(--dur) var(--ease), transform 0.06s var(--ease);
}
.nb-primary:hover:not(:disabled) { background: var(--brand-deep); }
:root[data-theme="dark"] .nb-primary:hover:not(:disabled) { background: var(--brand-bright); border-color: var(--brand-bright); }
.nb-primary:active:not(:disabled) { transform: translateY(1px); }

.nb-ghost {
  background: var(--surface);
  color: var(--text-strong);
  border: 1px solid var(--line-strong);
  font-weight: var(--fw-medium);
}
.nb-ghost:hover:not(:disabled) { background: var(--bg-elev); }

.nb-danger {
  background: transparent;
  color: var(--cinnabar);
  border: 1px solid var(--cinnabar);
}
.nb-danger:hover:not(:disabled) { background: var(--cinnabar-soft); }

.nb-subtle {
  background: transparent;
  color: var(--text-mute);
  border: 1px solid var(--line);
}
.nb-subtle:hover:not(:disabled) { color: var(--text); border-color: var(--line-strong); background: var(--surface-2); }

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
