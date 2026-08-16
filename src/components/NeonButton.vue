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
  gap: 0.45rem;
  border-radius: var(--r);
  font-weight: 500;
  letter-spacing: 0;
  transition: background var(--dur) var(--ease), border-color var(--dur) var(--ease), color var(--dur) var(--ease);
  overflow: hidden;
  white-space: nowrap;
}
.nb:disabled { opacity: 0.58; cursor: not-allowed; }
.nb:focus-visible { outline: 1px solid var(--gold); outline-offset: 2px; }
.nb-sm { padding: 0.36rem 0.82rem; font-size: 0.8rem; }
.nb-md { padding: 0.54rem 1.1rem; font-size: 0.88rem; }
.nb-lg { padding: 0; font-size: 0.95rem; height: 48px; }
.nb-block { width: 100%; }
.nb-content { display: inline-flex; align-items: center; gap: 0.45rem; }

.nb-primary {
  background: var(--primary-grad);
  color: var(--text-inverse);
  border: 1px solid rgba(122, 240, 228, 0.35);
  box-shadow: var(--glow-cyan);
}
.nb-primary:hover:not(:disabled) { filter: brightness(1.08); }

.nb-ghost {
  background: transparent;
  color: var(--gold-bright);
  border: 1px solid var(--line-bright);
}
.nb-ghost:hover:not(:disabled) { background: var(--gold-soft); }

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
