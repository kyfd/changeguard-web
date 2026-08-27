<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePanorama } from '@/composables/usePanorama'
import TechIcon from '@/components/TechIcon.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import ChangeLattice from '@/components/ChangeLattice.vue'

const pano = usePanorama()
const {
  ws, total, risks, highRisk, appRanking, topRules,
  pending, closed, experiments, enabledPolicies, threat, closureRate,
} = pano
const router = useRouter()

const clock = ref('')
let timer: any
function tick() {
  clock.value = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date())
}
onMounted(() => { tick(); timer = setInterval(tick, 1000) })
onBeforeUnmount(() => clearInterval(timer))

const briefCopy = computed(() => {
  if (threat.value.level === 'CRITICAL') return '高危未闭环，审批应暂缓'
  if (threat.value.level === 'ELEVATED') return '风险升高，请优先处理高危单'
  if (threat.value.level === 'WATCH') return '待审堆积，请保持审批节奏'
  return '治理节奏平稳，证据链完整'
})

const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
function useCountUp(source: () => number) {
  const n = ref(0)
  let raf = 0
  function run(end: number) {
    if (reduced) { n.value = end; return }
    const start = n.value
    if (start === end) return
    const t0 = performance.now()
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / 720)
      n.value = Math.round(start + (end - start) * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(step)
  }
  watch(source, run, { immediate: true })
  return n
}

const pendingN = useCountUp(() => pending.value)
const highN = useCountUp(() => highRisk.value)
const closureN = useCountUp(() => closureRate.value)
const svcN = useCountUp(() => ws.apps?.length || 0)

const latticeValues = computed(() => ({
  rule: ws.policies?.length || 0,
  verify: experiments.value,
  approve: pending.value,
  audit: ws.audits?.length || 0,
  rollback: closed.value,
  svc: ws.apps?.length || 0,
  sql: highRisk.value,
  k8s: ws.apps?.length || 0,
  cfg: enabledPolicies.value,
  api: total.value,
  evidence: ws.audits?.length || 0,
  gate: pending.value,
  pass: closed.value,
}))

const satellites = computed(() =>
  (ws.apps || []).slice(0, 8).map((a: any) => ({
    id: String(a.id || a.code || a.name),
    label: String(a.name || a.code || '服务'),
    value: appRanking.value.find(x => x.name === a.name)?.count ?? 0,
  })),
)

const hotNodes = computed(() => {
  const ids: string[] = []
  if (highRisk.value > 0) ids.push('sql', 'verify')
  if (pending.value > 0) ids.push('approve', 'gate')
  return ids
})

const NODE_ROUTE: Record<string, string> = {
  rule: 'policies', verify: 'risks', approve: 'approvals', audit: 'audits',
  rollback: 'changes', svc: 'apps', sql: 'risks', k8s: 'apps', cfg: 'policies',
  api: 'changes', evidence: 'audits', gate: 'approvals', pass: 'changes',
}

function go(route: string) { router.push({ name: route }) }
function onSelect(id: string) { go(NODE_ROUTE[id] || 'apps') }
</script>

<template>
  <section class="deck">
    <div class="field" aria-hidden="true"></div>
    <div class="veil" aria-hidden="true"></div>
    <ChangeLattice
      expand
      interactive
      :values="latticeValues"
      :hot="hotNodes"
      :satellites="satellites"
      @select="onSelect"
    />

    <header class="hud">
      <div class="hud-brand">
        <strong>治理全景</strong>
        <StatusBadge type="status" :value="threat.level === 'NOMINAL' ? 'OK' : threat.level === 'CRITICAL' ? 'CRITICAL' : 'PENDING'" size="sm">
          {{ threat.label }}
        </StatusBadge>
        <span class="hud-brief">{{ briefCopy }}</span>
      </div>
      <div class="hud-actions">
        <time class="mono">{{ clock }}</time>
        <button type="button" class="exit" @click="go('dashboard')">
          <TechIcon name="arrow" :size="14" /> 工作台
        </button>
      </div>
    </header>

    <div class="stats">
      <button type="button" @click="go('approvals')"><span>待审批</span><b>{{ pendingN }}</b></button>
      <button type="button" class="warn" @click="go('risks')"><span>高危</span><b>{{ highN }}</b></button>
      <button type="button" @click="go('changes')"><span>闭环</span><b>{{ closureN }}%</b></button>
      <button type="button" @click="go('apps')"><span>服务</span><b>{{ svcN }}</b></button>
    </div>

    <ul v-if="topRules.length" class="hits">
      <li v-for="(r, i) in topRules.slice(0, 3)" :key="r.code" @click="go('risks')">
        <em>{{ String(i + 1).padStart(2, '0') }}</em>
        <span>{{ r.title }}</span>
        <b>{{ r.count }}</b>
      </li>
    </ul>

    <p class="hint">点击外圈节点进入对应治理面 · 引擎在线</p>
  </section>
</template>

<style scoped>
.deck {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 100dvh;
  overflow: hidden;
  color: var(--text);
  background: var(--bg-void);
}
.field {
  position: absolute;
  inset: 0;
  background: url("../assets/images/deck.jpg") center / cover no-repeat;
  opacity: 0.58;
}
.veil {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(70% 60% at 50% 52%, rgba(5, 7, 12, 0.08), rgba(5, 7, 12, 0.52) 78%),
    linear-gradient(180deg, rgba(5, 7, 12, 0.22) 0%, transparent 22%, transparent 78%, rgba(5, 7, 12, 0.38) 100%);
}

.hud {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.05rem 1.4rem 0;
  pointer-events: none;
}
.hud-brand, .hud-actions { display: flex; align-items: center; gap: 0.75rem; pointer-events: auto; }
.hud-brand strong {
  font-size: 1.15rem;
  font-weight: 650;
  color: #fff;
}
.hud-brief { font-size: 0.82rem; color: rgba(232, 242, 248, 0.88); }
.hud-actions time { font-size: 0.84rem; color: rgba(232, 242, 248, 0.82); letter-spacing: 0.06em; }
.exit {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.38rem 0.75rem;
  border-radius: 999px;
  border: 1px solid var(--line-bright);
  color: var(--brand-bright);
  font-size: 0.8rem;
  background: rgba(8, 14, 22, 0.55);
  backdrop-filter: blur(10px);
}
.exit:hover { background: var(--brand-soft); }

.stats {
  position: absolute;
  top: 3.6rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 4;
  display: flex;
  gap: 1.6rem;
  padding: 0.55rem 1.2rem;
  border-radius: var(--r-pill);
  background: rgba(10, 14, 20, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.10);
  backdrop-filter: blur(14px);
}
.stats button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
  color: inherit;
  min-width: 3.2rem;
}
.stats span { font-size: 0.68rem; color: rgba(210, 226, 234, 0.78); }
.stats b {
  font-size: 1.25rem;
  font-weight: 650;
  color: var(--brand-bright);
  font-variant-numeric: tabular-nums;
}
.stats .warn b { color: var(--cinnabar); }

.hits {
  position: absolute;
  right: 1.3rem;
  bottom: 2.6rem;
  z-index: 4;
  width: 240px;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.hits li {
  display: grid;
  grid-template-columns: 1.4rem 1fr auto;
  gap: 0.4rem;
  align-items: center;
  padding: 0.4rem 0.55rem;
  border-radius: var(--r-lg);
  background: rgba(10, 14, 20, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.09);
  cursor: pointer;
  font-size: 0.78rem;
}
.hits li:hover { border-color: var(--line-bright); }
.hits em { color: var(--text-faint); font-size: 0.68rem; }
.hits span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hits b { color: var(--brand-bright); }

.hint {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0.85rem;
  z-index: 4;
  text-align: center;
  font-size: 0.72rem;
  color: rgba(214, 230, 238, 0.72);
  letter-spacing: 0.04em;
  pointer-events: none;
}

@media (max-width: 780px) {
  .hud { flex-direction: column; align-items: flex-start; gap: 0.6rem; }
  .hud-brief { display: none; }
  .stats { top: 5.4rem; gap: 0.9rem; padding: 0.4rem 0.8rem; }
  .hits { display: none; }
}
</style>
