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

const failedCount = computed(() => (ws.changes || []).filter((c: any) => c.status === 'CHECK_FAILED').length)

const pendingN = useCountUp(() => pending.value)
const failedN = useCountUp(() => failedCount.value)
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
      <button type="button" :class="{ mute: !pending }" @click="go('approvals')"><span>待审批</span><b>{{ pendingN }}</b></button>
      <button type="button" class="warn" :class="{ mute: !failedCount }" @click="go('changes')"><span>检查未通过</span><b>{{ failedN }}</b></button>
      <button type="button" class="warn" :class="{ mute: !highRisk }" @click="go('risks')"><span>高危</span><b>{{ highN }}</b></button>
      <button type="button" @click="go('changes')"><span>闭环</span><b>{{ closureN }}%</b></button>
      <button type="button" @click="go('apps')"><span>服务</span><b>{{ svcN }}</b></button>
    </div>

    <ul v-if="topRules.length" class="hits">
      <li class="hits-head mono">高频命中规则</li>
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
/* 大屏底纹用 hairline 网格而非照片：照片高光会吞掉节点标签，
   且画面主体应当是数据本身，不是素材。 */
.field {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(var(--grid-line) 1px, transparent 1px) 0 0 / 100% 44px,
    linear-gradient(90deg, var(--grid-line) 1px, transparent 1px) 0 0 / 44px 100%;
  mask-image: radial-gradient(120% 100% at 50% 50%, #000 35%, transparent 88%);
  -webkit-mask-image: radial-gradient(120% 100% at 50% 50%, #000 35%, transparent 88%);
}
/* 中心微亮，让视线落在图谱上；四角压暗收边 */
.veil {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(58% 52% at 50% 50%, color-mix(in srgb, var(--brand) 7%, transparent), transparent 72%),
    radial-gradient(120% 90% at 50% 50%, transparent 55%, var(--bg-void) 100%);
}
/* 缓慢扫描带：大屏值守的时间感，不参与信息表达故极低对比 */
.veil::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    transparent 42%,
    color-mix(in srgb, var(--brand) 9%, transparent) 50%,
    transparent 58%
  );
  animation: sweep 9s linear infinite;
}
@keyframes sweep {
  0% { transform: translateY(-100%); }
  100% { transform: translateY(100%); }
}
@media (prefers-reduced-motion: reduce) {
  .veil::after { animation: none; opacity: 0; }
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
  color: var(--text-strong);
}
.hud-brief { font-size: 0.82rem; color: var(--text-mute); }
.hud-actions time { font-size: 0.84rem; color: var(--text-mute); letter-spacing: 0.06em; font-variant-numeric: tabular-nums; }
.exit {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.38rem 0.75rem;
  border-radius: var(--r);
  border: 1px solid var(--line);
  color: var(--brand-bright);
  font-size: 0.8rem;
  background: var(--surface);
}
.exit:hover { border-color: var(--line-bright); }

.stats {
  position: absolute;
  top: 3.6rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 4;
  display: flex;
  gap: 0;
  border-radius: var(--r);
  background: var(--surface);
  border: 1px solid var(--line);
  overflow: hidden;
}
.stats button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  color: inherit;
  min-width: 5.4rem;
  padding: 0.5rem 0.9rem;
  border-left: 1px solid var(--line);
}
.stats button:first-child { border-left: 0; }
.stats button:hover { background: var(--bg-elev); }
.stats span { font-size: 0.68rem; color: var(--text-mute); }
.stats b {
  font-size: 1.25rem;
  font-weight: 650;
  color: var(--brand-bright);
  font-variant-numeric: tabular-nums;
  font-family: var(--font-mono);
  line-height: 1.1;
}
.stats .warn b { color: var(--cinnabar); }
/* 与工作台一致：零值不抢视觉重心 */
.stats .mute b { color: var(--text-faint); }

.hits {
  position: absolute;
  right: 1.3rem;
  bottom: 2.6rem;
  z-index: 4;
  width: 264px;
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 1px solid var(--line);
  border-radius: var(--r);
  background: var(--surface);
  overflow: hidden;
}
.hits-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.74rem;
  letter-spacing: 0.06em;
  color: var(--text-mute);
  padding: 0.5rem 0.6rem;
  background: var(--bg-elev);
  border-bottom: 1px solid var(--line);
}
.hits li:not(.hits-head) {
  display: grid;
  grid-template-columns: 1.4rem 1fr auto;
  gap: 0.4rem;
  align-items: center;
  padding: 0.48rem 0.6rem;
  border-top: 1px solid var(--line);
  cursor: pointer;
  font-size: 0.78rem;
}
.hits li:not(.hits-head):first-of-type { border-top: 0; }
.hits li:not(.hits-head):hover { background: var(--bg-elev); }
.hits em { color: var(--text-faint); font-size: 0.68rem; font-style: normal; font-family: var(--font-mono); }
.hits span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text); }
.hits b { color: var(--cinnabar); font-family: var(--font-mono); font-variant-numeric: tabular-nums; }

.hint {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0.85rem;
  z-index: 4;
  text-align: center;
  font-size: 0.72rem;
  color: var(--text-faint);
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
