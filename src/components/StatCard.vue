<script setup lang="ts">
/* 数字卡片：碑刻数值，无辉光 */
import { ref, watch, onMounted } from 'vue'

const props = withDefaults(defineProps<{
  value: number
  label: string
  suffix?: string
  tone?: 'gold' | 'cyan' | 'blue' | 'purple' | 'amber' | 'red' | 'green'
  icon?: string
  duration?: number
}>(), { tone: 'gold', duration: 1200 })

const display = ref(0)

function animate() {
  const start = display.value
  const end = props.value
  if (start === end) return
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (reduced) { display.value = end; return }
  const t0 = performance.now()
  const step = (now: number) => {
    const p = Math.min(1, (now - t0) / props.duration)
    const eased = 1 - Math.pow(1 - p, 3)
    display.value = Math.round(start + (end - start) * eased)
    if (p < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

onMounted(animate)
watch(() => props.value, animate)
</script>

<template>
  <div class="stat" :class="`stat-${tone}`">
    <div class="stat-inner">
      <div class="stat-val mono">
        <span class="stat-num">{{ display.toLocaleString() }}</span>
        <span class="stat-suffix" v-if="suffix">{{ suffix }}</span>
      </div>
      <div class="stat-label">{{ label }}</div>
    </div>
    <div class="stat-bar" aria-hidden="true"></div>
  </div>
</template>

<style scoped>
.stat {
  position: relative;
  padding: 1.15rem 1.3rem;
  border-radius: var(--r-lg);
  background: var(--surface);
  border: 1px solid var(--line);
  overflow: hidden;
  transition: border-color var(--dur);
}
.stat:hover { border-color: var(--line-bright); }
.stat-inner { position: relative; z-index: 2; }
.stat-val { display: flex; align-items: baseline; gap: 0.22rem; font-weight: 500; line-height: 1; }
.stat-num {
  font-size: 2.2rem;
  font-family: var(--font-display);
  color: var(--text-strong);
  letter-spacing: -0.02em;
  font-weight: 500;
}
.stat-suffix { font-size: 0.9rem; color: var(--text-mute); }
.stat-label { margin-top: 0.5rem; font-size: 0.8rem; color: var(--text-mute); letter-spacing: 0; }
.stat-bar { position: absolute; left: 0; bottom: 0; height: 1px; width: 100%; background: currentColor; opacity: 0.55; }
.stat-gold, .stat-cyan { color: var(--gold); }
.stat-blue { color: var(--text-mute); }
.stat-purple { color: var(--text-mute); }
.stat-amber { color: var(--amber); }
.stat-red { color: var(--cinnabar); }
.stat-green { color: var(--jade); }
</style>
