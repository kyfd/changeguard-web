<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  icon?: string
  tone?: 'gold' | 'cyan' | 'blue' | 'purple' | 'amber' | 'red' | 'green'
  scan?: boolean
  glow?: boolean
}>(), { tone: 'gold', scan: false, glow: false })
</script>

<template>
  <article class="gp" :class="[`gp-${tone}`, { 'gp-glow': glow }]">
    <header v-if="title || $slots.header" class="gp-header">
      <slot name="header">
        <i class="gp-icon" v-if="icon" aria-hidden="true"></i>
        <h3 class="gp-title">{{ title }}</h3>
      </slot>
    </header>
    <div class="gp-body"><slot /></div>
    <slot name="footer" />
  </article>
</template>

<style scoped>
/* 哑光石面：surface + hairline 边 + 沉降阴影，无玻璃无辉光 */
.gp {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-card);
  overflow: hidden;
}
:root[data-theme="light"] .gp {
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6), var(--shadow-card);
}

.gp-gold, .gp-cyan { color: var(--brand); }
.gp-blue { color: var(--text-mute); }
.gp-purple { color: var(--text-mute); }
.gp-amber { color: var(--amber); }
.gp-red { color: var(--cinnabar); }
.gp-green { color: var(--jade); }

.gp-header { display: flex; align-items: center; gap: 0.5rem; padding: 14px 16px 4px; }
.gp-icon { width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex: none; }
.gp-title { font-size: var(--fs-14); font-weight: var(--fw-semibold); color: var(--text-strong); letter-spacing: 0; }
.gp-body { padding: 0.35rem 16px 16px; }
</style>
