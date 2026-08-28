<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePanorama } from '@/composables/usePanorama'
import TechIcon from '@/components/TechIcon.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import ChangeLattice from '@/components/ChangeLattice.vue'

const pano = usePanorama()
const {
  ws, total, risks, highRisk, appRanking, topRules, flow,
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

/* 每个节点必须绑定互不重复的指标：此前 audit/evidence、svc/k8s、
   rollback/pass、approve/gate 四对各自渲染同一个数字，等于把一个事实画了两遍。 */
const findingsTotal = computed(() =>
  (ws.changes || []).reduce((n: number, c: any) => n + (c.findings?.length || 0), 0),
)
const blockingTotal = computed(() =>
  (ws.changes || []).reduce(
    (n: number, c: any) => n + (c.findings || []).filter((f: any) => f.blocking).length,
    0,
  ),
)
const draftCount = computed(() => (ws.changes || []).filter((c: any) => c.status === 'DRAFT').length)
const rejectedCount = computed(() => (ws.changes || []).filter((c: any) => c.status === 'REJECTED').length)

const latticeValues = computed(() => ({
  rule: ws.policies?.length || 0,
  verify: experiments.value,
  approve: pending.value,
  audit: ws.audits?.length || 0,
  rollback: rejectedCount.value,
  svc: ws.apps?.length || 0,
  sql: highRisk.value,
  k8s: draftCount.value,
  cfg: enabledPolicies.value,
  api: total.value,
  evidence: findingsTotal.value,
  gate: blockingTotal.value,
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

/* 漏斗最大阶段决定横条比例；这是全景真正要回答的问题：变更卡在哪一环。 */
const flowMax = computed(() => Math.max(1, ...flow.value.map(s => s.count)))
const bottleneck = computed(() => {
  const open = flow.value.filter(s => s.label !== '已闭环')
  return open.reduce((a, b) => (b.count > a.count ? b : a), open[0])
})
const riskMix = computed(() => {
  const order = [
    { key: 'HIGH', label: '高危', tone: 'red' },
    { key: 'MEDIUM', label: '中危', tone: 'amber' },
    { key: 'LOW', label: '低危', tone: 'green' },
    { key: 'UNKNOWN', label: '未评', tone: 'mute' },
  ]
  const t = Math.max(1, total.value)
  return order.map(o => ({ ...o, count: risks.value[o.key] || 0, pct: Math.round((risks.value[o.key] || 0) / t * 100) }))
})
const appMax = computed(() => Math.max(1, ...appRanking.value.map(a => a.count)))
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

    <!-- 治理漏斗：全景要回答的首要问题是「变更卡在哪一环」，
         此前这份数据（flow）已存在于 composable 却从未被渲染。 -->
    <section class="panel flow-panel">
      <header>
        <span>变更流转</span>
        <em v-if="bottleneck && bottleneck.count">积压在「{{ bottleneck.label }}」</em>
      </header>
      <button
        v-for="s in flow"
        :key="s.label"
        type="button"
        class="flow-row"
        :class="{ peak: bottleneck && s.label === bottleneck.label && s.count > 0 }"
        @click="go(s.route)"
      >
        <span class="flow-label">{{ s.label }}</span>
        <span class="flow-track"><i :style="{ width: (s.count / flowMax * 100) + '%' }"></i></span>
        <b :class="{ zero: !s.count }">{{ s.count }}</b>
      </button>
    </section>

    <!-- 风险构成 + 服务排名：把 risks / appRanking 这两份闲置数据用起来 -->
    <section class="panel side-panel">
      <header><span>风险构成</span></header>
      <div class="mix">
        <i v-for="m in riskMix" :key="m.key" :class="'seg t-' + m.tone" :style="{ flexGrow: m.count || 0 }"></i>
      </div>
      <ul class="legend">
        <li v-for="m in riskMix" :key="m.key">
          <i :class="'dot t-' + m.tone"></i><span>{{ m.label }}</span><b>{{ m.count }}</b>
        </li>
      </ul>
      <header class="sub"><span>变更最多的服务</span></header>
      <ul class="rank">
        <li v-for="a in appRanking.slice(0, 4)" :key="a.name">
          <span class="ellipsis">{{ a.name }}</span>
          <i class="bar"><em :style="{ width: (a.count / appMax * 100) + '%' }"></em></i>
          <b>{{ a.count }}</b>
        </li>
      </ul>
    </section>

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
  padding: var(--sp-4) var(--sp-5) 0;
  pointer-events: none;
}
.hud-brand, .hud-actions { display: flex; align-items: center; gap: var(--sp-3); pointer-events: auto; }
.hud-brand strong {
  font-size: var(--fs-16);
  font-weight: var(--fw-semibold);
  color: var(--text-strong);
}
.hud-brief { font-size: var(--fs-12); color: var(--text-mute); }
.hud-actions time { font-size: var(--fs-12); color: var(--text-mute); letter-spacing: 0.02em; font-variant-numeric: tabular-nums; }
.exit {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
  height: 28px;
  padding: 0 var(--sp-3);
  border-radius: var(--r);
  border: 1px solid var(--line);
  color: var(--brand-bright);
  font-size: var(--fs-12);
  background: var(--surface);
}
.exit:hover { border-color: var(--line-bright); }

.stats {
  position: absolute;
  top: var(--sp-12);
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
  gap: 2px;
  color: inherit;
  min-width: 86px;
  padding: var(--sp-2) var(--sp-3);
  border-left: 1px solid var(--line);
}
.stats button:first-child { border-left: 0; }
.stats button:hover { background: var(--bg-elev); }
.stats span { font-size: var(--fs-11); color: var(--text-mute); }
.stats b {
  font-size: var(--fs-20);
  font-weight: var(--fw-semibold);
  color: var(--brand-bright);
  font-variant-numeric: tabular-nums;
  font-family: var(--font-mono);
  line-height: var(--lh-tight);
}
.stats .warn b { color: var(--cinnabar); }
/* 与工作台一致：零值不抢视觉重心 */
.stats .mute b { color: var(--text-faint); }

/* 左右两侧信息面板：图谱是背景，数据是主体 */
.panel {
  position: absolute;
  z-index: 4;
  width: 268px;
  border: 1px solid var(--line);
  border-radius: var(--r);
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  backdrop-filter: blur(6px);
  overflow: hidden;
}
.panel > header {
  display: flex; align-items: baseline; justify-content: space-between; gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-3);
  background: var(--bg-elev);
  border-bottom: 1px solid var(--line);
  font-size: var(--fs-11); letter-spacing: 0.04em; color: var(--text-mute);
}
.panel > header em { font-style: normal; color: var(--cinnabar); font-size: var(--fs-11); }
.panel > header.sub { border-top: 1px solid var(--line); }

.flow-panel { left: var(--sp-5); top: 96px; }
.flow-row {
  width: 100%;
  display: grid;
  grid-template-columns: 64px 1fr 28px;
  align-items: center;
  gap: var(--sp-2);
  height: 32px;
  padding: 0 var(--sp-3);
  color: inherit;
  text-align: left;
  border-top: 1px solid var(--line);
}
.flow-row:first-of-type { border-top: 0; }
.flow-row:hover { background: var(--bg-elev); }
.flow-label { font-size: var(--fs-12); color: var(--text-mute); }
.flow-track { height: 6px; border-radius: 3px; background: var(--bg-elev); overflow: hidden; }
.flow-track i { display: block; height: 100%; background: var(--brand); border-radius: 3px; transition: width var(--dur) var(--ease); }
/* 瓶颈阶段是这页的结论，必须比其他阶段更重 */
.flow-row.peak .flow-track i { background: var(--cinnabar); }
.flow-row.peak .flow-label { color: var(--text-strong); }
.flow-row.peak b { color: var(--cinnabar); }
.flow-row b {
  font-size: var(--fs-13); font-family: var(--font-mono);
  font-variant-numeric: tabular-nums; text-align: right; color: var(--text);
}
.flow-row b.zero { color: var(--text-faint); }

.side-panel { right: var(--sp-5); top: 96px; }
.mix { display: flex; height: 8px; margin: var(--sp-3) var(--sp-3) var(--sp-2); border-radius: 4px; overflow: hidden; background: var(--bg-elev); }
.mix .seg { min-width: 0; }
.t-red { background: var(--cinnabar); }
.t-amber { background: var(--gold); }
.t-green { background: var(--jade, #3f9d6d); }
.t-mute { background: var(--line-strong); }
.legend { display: grid; grid-template-columns: 1fr 1fr; gap: 2px var(--sp-3); padding: 0 var(--sp-3) var(--sp-3); }
.legend li { display: flex; align-items: center; gap: var(--sp-2); font-size: var(--fs-11); color: var(--text-mute); }
.legend .dot { width: 6px; height: 6px; border-radius: 50%; flex: none; }
.legend b { margin-left: auto; font-family: var(--font-mono); font-variant-numeric: tabular-nums; color: var(--text); }
.rank { padding: var(--sp-2) var(--sp-3) var(--sp-3); display: flex; flex-direction: column; gap: var(--sp-2); }
.rank li { display: grid; grid-template-columns: 1fr 56px 20px; align-items: center; gap: var(--sp-2); font-size: var(--fs-11); color: var(--text-mute); }
.rank .bar { height: 4px; border-radius: 2px; background: var(--bg-elev); overflow: hidden; }
.rank .bar em { display: block; height: 100%; background: var(--brand); border-radius: 2px; }
.rank b { font-family: var(--font-mono); font-variant-numeric: tabular-nums; text-align: right; color: var(--text); }

.hits {
  position: absolute;
  right: var(--sp-5);
  bottom: var(--sp-8);
  z-index: 4;
  width: 268px;
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 1px solid var(--line);
  border-radius: var(--r);
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  backdrop-filter: blur(6px);
  overflow: hidden;
}
.hits-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--fs-11);
  letter-spacing: 0.04em;
  color: var(--text-mute);
  padding: var(--sp-2) var(--sp-3);
  background: var(--bg-elev);
  border-bottom: 1px solid var(--line);
}
.hits li:not(.hits-head) {
  display: grid;
  grid-template-columns: 20px 1fr auto;
  gap: var(--sp-2);
  align-items: center;
  padding: var(--sp-2) var(--sp-3);
  border-top: 1px solid var(--line);
  cursor: pointer;
  font-size: var(--fs-12);
}
.hits li:not(.hits-head):first-of-type { border-top: 0; }
.hits li:not(.hits-head):hover { background: var(--bg-elev); }
.hits em { color: var(--text-faint); font-size: var(--fs-11); font-style: normal; font-family: var(--font-mono); }
.hits span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text); }
.hits b { color: var(--cinnabar); font-family: var(--font-mono); font-variant-numeric: tabular-nums; }

.hint {
  position: absolute;
  left: 0;
  right: 0;
  bottom: var(--sp-3);
  z-index: 4;
  text-align: center;
  font-size: var(--fs-11);
  color: var(--text-faint);
  letter-spacing: 0.04em;
  pointer-events: none;
}

@media (max-width: 1280px) {
  .side-panel { display: none; }
}
@media (max-width: 780px) {
  .hud { flex-direction: column; align-items: flex-start; gap: var(--sp-2); }
  .hud-brief { display: none; }
  .stats { top: 84px; }
  .hits, .flow-panel { display: none; }
}
</style>
