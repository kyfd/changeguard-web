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
.gp {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-card);
  overflow: hidden;
  transition: border-color var(--dur) var(--ease);
}
.gp:hover { border-color: var(--line-bright); }
.gp-glow { box-shadow: var(--shadow-card); }

.gp-gold, .gp-cyan { color: var(--gold); }
.gp-blue { color: var(--text-mute); }
.gp-purple { color: var(--text-mute); }
.gp-amber { color: var(--amber); }
.gp-red { color: var(--cinnabar); }
.gp-green { color: var(--jade); }

.gp-header { display: flex; align-items: center; gap: 0.5rem; padding: 0.95rem 1.2rem 0.5rem; }
.gp-icon { width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex: none; }
.gp-title { font-size: 0.95rem; font-weight: 500; color: var(--text-strong); letter-spacing: 0; }
.gp-body { padding: 0.35rem 1.2rem 1.15rem; }
</style>
