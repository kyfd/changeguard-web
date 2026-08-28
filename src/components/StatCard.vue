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
      <div class="stat-label kicker">{{ label }}</div>
      <div class="stat-val">
        <span class="stat-num">{{ display.toLocaleString() }}</span>
        <span class="stat-suffix" v-if="suffix">{{ suffix }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 参考台账的指标卡：kicker 标签在上，24px 实数值在下，无底色条 */
.stat {
  position: relative;
  padding: 16px;
  border-radius: var(--r-lg);
  background: var(--surface);
  border: 1px solid var(--line);
  box-shadow: var(--shadow-card);
  overflow: hidden;
}
:root[data-theme="light"] .stat {
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6), var(--shadow-card);
}
.stat-inner { position: relative; z-index: 2; }
.stat-label { display: block; margin-bottom: 10px; }
.stat-val { display: flex; align-items: baseline; gap: 0.22rem; line-height: var(--lh-tight); }
.stat-num {
  font-size: var(--fs-24);
  font-family: var(--font-sans);
  color: var(--text-strong);
  letter-spacing: -0.01em;
  font-weight: var(--fw-semibold);
  font-variant-numeric: tabular-nums;
}
.stat-suffix { font-size: var(--fs-12); color: var(--text-mute); }
.stat-gold .stat-num, .stat-cyan .stat-num { color: var(--brand); }
.stat-blue .stat-num { color: var(--text-strong); }
.stat-purple .stat-num { color: var(--text-strong); }
.stat-amber .stat-num { color: var(--amber); }
.stat-red .stat-num { color: var(--cinnabar); }
.stat-green .stat-num { color: var(--jade); }
</style>
