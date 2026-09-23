<script setup lang="ts">
/* 总览大屏：全屏深色指挥舱。中心为治理拓扑（ChangeLattice），四周为发光数据面板。
   主题变量在 .deck 内局部覆盖为霓虹色板，拓扑 canvas 按变量取色，自动适配。
   全部指标从工作区已加载数据派生，与工作台同源。 */
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { usePanorama } from '@/composables/usePanorama'
import TechIcon from '@/components/TechIcon.vue'
import ChangeLattice from '@/components/ChangeLattice.vue'
import { STATUS_LABEL } from '@/lib/labels'

const {
  ws, total, risks, highRisk, appRanking, topRules, flow,
  pending, closed, experiments, enabledPolicies, threat, closureRate,
} = usePanorama()
const router = useRouter()
function go(name: string) { router.push({ name }) }
function open(id: string) { router.push({ name: 'change-detail', params: { id } }) }

/* ── 时钟 / 刷新 / 全屏 ───────────────────────────────── */
const clock = ref(''); const date = ref('')
let timer: any
function tick() {
  const d = new Date()
  clock.value = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(d)
  date.value = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).format(d)
}
const refreshing = ref(false)
async function refresh() {
  refreshing.value = true
  try { await ws.load(true) } catch { /* store 自行提示 */ } finally { refreshing.value = false }
}
let autoRefresh: any
onMounted(() => { tick(); timer = setInterval(tick, 1000); autoRefresh = setInterval(() => { if (!document.hidden) refresh() }, 60_000) })
onBeforeUnmount(() => { clearInterval(timer); clearInterval(autoRefresh) })
const isFull = ref(false)
async function toggleFull() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await document.documentElement.requestFullscreen()
  } catch { /* 浏览器拒绝时忽略 */ }
}
function onFsChange() { isFull.value = Boolean(document.fullscreenElement) }
onMounted(() => document.addEventListener('fullscreenchange', onFsChange))
onBeforeUnmount(() => document.removeEventListener('fullscreenchange', onFsChange))

/* ── 数字滚动 ─────────────────────────────────────────── */
const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
function useCountUp(source: () => number) {
  const n = ref(0); let raf = 0
  watch(source, end => {
    if (reduced) { n.value = end; return }
    const start = n.value; const t0 = performance.now()
    cancelAnimationFrame(raf)
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / 900)
      n.value = Math.round(start + (end - start) * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
  }, { immediate: true })
  return n
}

const changes = computed<any[]>(() => ws.changes || [])
const failedCount = computed(() => changes.value.filter(c => c.status === 'CHECK_FAILED').length)
const blockingOpen = computed(() => changes.value.reduce((n, c) => n + (c.findings || []).filter((f: any) => f.blocking && !['RESOLVED', 'VERIFIED'].includes(f.status)).length, 0))
const findingsTotal = computed(() => changes.value.reduce((n, c) => n + (c.findings?.length || 0), 0))
const draftCount = computed(() => changes.value.filter(c => c.status === 'DRAFT').length)
const rejectedCount = computed(() => changes.value.filter(c => c.status === 'REJECTED').length)

const kpis = computed(() => [
  { key: 'total', label: '变更总数', en: 'CHANGES', value: total.value, route: 'changes', tone: 'cyan' },
  { key: 'pending', label: '待审批', en: 'PENDING', value: pending.value, route: 'approvals', tone: 'cyan' },
  { key: 'failed', label: '检查未通过', en: 'BLOCKED', value: failedCount.value, route: 'changes', tone: 'red' },
  { key: 'high', label: '高危变更', en: 'HIGH RISK', value: highRisk.value, route: 'risks', tone: 'red' },
  { key: 'blocking', label: '未关闭阻断项', en: 'FINDINGS', value: blockingOpen.value, route: 'risks', tone: 'amber' },
  { key: 'closure', label: '通行证消费率', en: 'CLOSURE', value: closureRate.value, suffix: '%', route: 'changes', tone: 'green' },
])
const kpiNums = kpis.value.map((_, i) => useCountUp(() => kpis.value[i].value))

/* ── 拓扑数据 ─────────────────────────────────────────── */
const latticeValues = computed(() => ({
  rule: ws.policies?.length || 0, verify: experiments.value, approve: pending.value,
  audit: ws.audits?.length || 0, rollback: rejectedCount.value, svc: ws.apps?.length || 0,
  sql: highRisk.value, k8s: draftCount.value, cfg: enabledPolicies.value, api: total.value,
  evidence: findingsTotal.value, gate: blockingOpen.value, pass: closed.value,
}))
const satellites = computed(() => (ws.apps || []).slice(0, 8).map((a: any) => ({
  id: String(a.id || a.name), label: String(a.name || '服务'),
  value: appRanking.value.find(x => x.name === a.name)?.count ?? 0,
})))
const hotNodes = computed(() => {
  const ids: string[] = []
  if (highRisk.value > 0) ids.push('sql', 'verify')
  if (pending.value > 0 || blockingOpen.value > 0) ids.push('approve', 'gate')
  return ids
})
const NODE_ROUTE: Record<string, string> = {
  rule: 'policies', verify: 'risks', approve: 'approvals', audit: 'audits', rollback: 'changes', svc: 'apps',
  sql: 'risks', k8s: 'apps', cfg: 'policies', api: 'changes', evidence: 'audits', gate: 'approvals', pass: 'changes',
}
function onSelect(id: string) { go(NODE_ROUTE[id] || 'apps') }

/* ── 态势 ─────────────────────────────────────────────── */
const threatText = computed(() => ({ CRITICAL: '危急', ELEVATED: '升高', WATCH: '关注', NOMINAL: '平稳' } as Record<string, string>)[threat.value.level] || '平稳')
const threatScore = computed(() => {
  if (!total.value) return 0
  const s = (highRisk.value / total.value) * 70 + Math.min(20, pending.value * 4) + Math.min(10, blockingOpen.value / 10)
  return Math.min(100, Math.round(s))
})
const scoreN = useCountUp(() => threatScore.value)

/* ── 流转 ─────────────────────────────────────────────── */
const flowMax = computed(() => Math.max(1, ...flow.value.map(s => s.count)))
const bottleneck = computed(() => {
  const open = flow.value.filter(s => !s.statuses.some(st => ['COMPLETED', 'REJECTED', 'APPROVED'].includes(st)))
  const top = open.reduce((a, b) => (b.count > a.count ? b : a), open[0])
  return top && top.count > 0 ? top : null
})

/* ── 风险构成 ─────────────────────────────────────────── */
const riskMix = computed(() => {
  const order = [
    { key: 'HIGH', label: '高危', color: '#ff4d6a' },
    { key: 'MEDIUM', label: '中危', color: '#ffb547' },
    { key: 'LOW', label: '低危', color: '#2de0a7' },
    { key: 'UNKNOWN', label: '未评估', color: '#5b6b8c' },
  ]
  const t = Math.max(1, total.value)
  return order.map(o => ({ ...o, count: risks.value[o.key] || 0, pct: Math.round((risks.value[o.key] || 0) / t * 100) }))
})
const R = 40, C = 2 * Math.PI * R
const donut = computed(() => {
  let acc = 0; const t = Math.max(1, total.value)
  return riskMix.value.filter(m => m.count > 0).map(m => {
    const len = (m.count / t) * C
    const seg = { ...m, dash: `${Math.max(0, len - 2)} ${C}`, offset: -acc }
    acc += len
    return seg
  })
})

/* ── AI 分析 ──────────────────────────────────────────── */
function rank(r?: string) { return ({ LOW: 1, MEDIUM: 2, HIGH: 3 } as Record<string, number>)[String(r || '').toUpperCase()] || 0 }
const analysis = computed(() => {
  const analysed = changes.value.filter(c => c.analysis?.provider)
  const llm = analysed.filter(c => /^(openai-compatible|anthropic)/.test(String(c.analysis.provider)))
  const tools = llm.reduce((n, c) => n + (Number(c.analysis.tool_calls) || 0), 0)
  return {
    llm: llm.length, fallback: analysed.length - llm.length,
    rate: analysed.length ? Math.round(llm.length / analysed.length * 100) : 0,
    upgraded: llm.filter(c => rank(c.analysis.risk) > rank(c.risk)).length,
    avgTools: llm.length ? (tools / llm.length).toFixed(1) : '0',
    model: llm.find(c => c.analysis.model)?.analysis.model || '',
  }
})
const aiRateN = useCountUp(() => analysis.value.rate)

/* ── 列表 ─────────────────────────────────────────────── */
const appMax = computed(() => Math.max(1, ...appRanking.value.map(a => a.count)))
const ruleMax = computed(() => Math.max(1, ...topRules.value.map(r => r.count)))
const feed = computed(() => [...changes.value]
  .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))
  .slice(0, 12))
function rel(iso?: string) {
  if (!iso) return '—'
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return '刚刚'
  if (s < 3600) return `${Math.floor(s / 60)} 分钟前`
  if (s < 86400) return `${Math.floor(s / 3600)} 小时前`
  return `${Math.floor(s / 86400)} 天前`
}
</script>

<template>
  <section class="deck" :class="'lv-' + threat.level.toLowerCase()">
    <div class="grid-bg" aria-hidden="true"></div>
    <div class="scan" aria-hidden="true"></div>

    <!-- 中心拓扑 -->
    <div class="core">
      <ChangeLattice expand interactive :values="latticeValues" :hot="hotNodes" :satellites="satellites" @select="onSelect" />
      <div class="core-ring" aria-hidden="true"><i></i><i></i></div>
    </div>

    <!-- 顶栏 -->
    <header class="top">
      <div class="brand">
        <span class="logo"><TechIcon name="shield" :size="18" /></span>
        <div>
          <strong>ChangeGuard 变更治理态势</strong>
          <small class="mono">GOVERNANCE COMMAND CENTER</small>
        </div>
      </div>
      <div class="title-bar" aria-hidden="true"><i></i><span class="mono">{{ ws.apps?.length || 0 }} SERVICES · {{ enabledPolicies }} RULES ONLINE</span><i></i></div>
      <div class="actions">
        <div class="time"><b class="mono">{{ clock }}</b><small>{{ date }}</small></div>
        <button type="button" class="icon-btn" :disabled="refreshing" aria-label="刷新数据" @click="refresh"><TechIcon name="refresh" :size="15" :class="{ spin: refreshing }" /></button>
        <button type="button" class="icon-btn" :aria-label="isFull ? '退出全屏' : '全屏'" @click="toggleFull"><TechIcon name="layers" :size="15" /></button>
        <button type="button" class="exit" @click="go('dashboard')"><TechIcon name="gauge" :size="14" /> 返回工作台</button>
      </div>
    </header>

    <!-- KPI 条 -->
    <div class="kpis">
      <button v-for="(k, i) in kpis" :key="k.key" type="button" class="kpi" :class="'t-' + k.tone" @click="go(k.route)">
        <span class="en mono">{{ k.en }}</span>
        <b class="mono">{{ kpiNums[i] }}<em v-if="k.suffix">{{ k.suffix }}</em></b>
        <span class="zh">{{ k.label }}</span>
        <i class="corner" aria-hidden="true"></i>
      </button>
    </div>

    <!-- 左列 -->
    <aside class="col left">
      <section class="panel">
        <header><span class="h">态势评估</span><span class="mono tag" :class="'lv'">{{ threatText }}</span></header>
        <div class="threat">
          <div class="gauge" :style="{ '--p': threatScore }"><b class="mono">{{ scoreN }}</b><small>风险指数</small></div>
          <ul>
            <li><span>高危占比</span><b class="mono">{{ total ? Math.round(highRisk / total * 100) : 0 }}%</b></li>
            <li><span>待审批</span><b class="mono">{{ pending }}</b></li>
            <li><span>积压阶段</span><b>{{ bottleneck?.label || '无' }}</b></li>
          </ul>
        </div>
      </section>

      <section class="panel">
        <header><span class="h">变更流转</span><span class="mono sub">PIPELINE</span></header>
        <button v-for="s in flow" :key="s.label" type="button" class="f-row" :class="{ peak: bottleneck && s.label === bottleneck.label }" @click="go(s.route)">
          <span class="f-label">{{ s.label }}</span>
          <span class="f-track"><i :style="{ width: Math.max(2, s.count / flowMax * 100) + '%' }"></i></span>
          <b class="mono" :class="{ zero: !s.count }">{{ s.count }}</b>
        </button>
      </section>

      <section class="panel grow">
        <header><span class="h">变更最多的服务</span><span class="mono sub">TOP SERVICES</span></header>
        <ul class="bars">
          <li v-for="(a, i) in appRanking" :key="a.name">
            <em class="mono">{{ String(i + 1).padStart(2, '0') }}</em>
            <span class="ellipsis">{{ a.name }}</span>
            <i class="bar"><u :style="{ width: (a.count / appMax * 100) + '%' }"></u></i>
            <b class="mono">{{ a.count }}</b>
          </li>
        </ul>
      </section>
    </aside>

    <!-- 右列 -->
    <aside class="col right">
      <section class="panel">
        <header><span class="h">AI 风险分析</span><button type="button" class="link" @click="go('settings')">模型设置 ›</button></header>
        <div class="ai">
          <div class="ring" :style="{ '--p': analysis.rate }"><b class="mono">{{ aiRateN }}<em>%</em></b><small>模型覆盖</small></div>
          <ul>
            <li><span>模型分析</span><b class="mono c-cyan">{{ analysis.llm }}</b></li>
            <li><span>规则降级</span><b class="mono c-mute">{{ analysis.fallback }}</b></li>
            <li><span>AI 上调风险</span><b class="mono c-amber">{{ analysis.upgraded }}</b></li>
            <li><span>平均工具调用</span><b class="mono">{{ analysis.avgTools }}</b></li>
          </ul>
        </div>
        <p v-if="analysis.model" class="model mono">MODEL · {{ analysis.model }}</p>
      </section>

      <section class="panel">
        <header><span class="h">风险构成</span><span class="mono sub">RISK MIX</span></header>
        <div class="mix">
          <svg viewBox="0 0 100 100" class="donut" role="img" :aria-label="`高危 ${risks.HIGH || 0} 中危 ${risks.MEDIUM || 0} 低危 ${risks.LOW || 0}`">
            <circle cx="50" cy="50" :r="R" class="d-bg" />
            <circle v-for="s in donut" :key="s.key" cx="50" cy="50" :r="R" class="d-seg" :stroke="s.color" :stroke-dasharray="s.dash" :stroke-dashoffset="s.offset" />
          </svg>
          <ul class="legend">
            <li v-for="m in riskMix" :key="m.key"><i :style="{ background: m.color, boxShadow: '0 0 8px ' + m.color }"></i><span>{{ m.label }}</span><b class="mono">{{ m.count }}</b><em class="mono">{{ m.pct }}%</em></li>
          </ul>
        </div>
      </section>

      <section class="panel grow">
        <header><span class="h">高频命中规则</span><button type="button" class="link" @click="go('policies')">规则 ›</button></header>
        <ul class="bars">
          <li v-for="(r, i) in topRules" :key="r.code" :title="r.code">
            <em class="mono">{{ String(i + 1).padStart(2, '0') }}</em>
            <span class="ellipsis">{{ r.title }}</span>
            <i class="bar red"><u :style="{ width: (r.count / ruleMax * 100) + '%' }"></u></i>
            <b class="mono">{{ r.count }}</b>
          </li>
          <li v-if="!topRules.length" class="empty">暂无规则命中</li>
        </ul>
      </section>
    </aside>

    <!-- 底部实时流 -->
    <footer class="feed">
      <span class="feed-h mono"><i class="dot"></i>LIVE</span>
      <div class="ticker">
        <div class="track" :class="{ still: reduced || feed.length < 4 }">
          <button v-for="(c, i) in [...feed, ...feed]" :key="c.id + '-' + i" type="button" class="item" @click="open(c.id)">
            <i class="r" :class="'r-' + String(c.risk).toLowerCase()"></i>
            <span class="ellipsis">{{ c.title || '未命名变更' }}</span>
            <small>{{ c.application_name || '—' }} · {{ STATUS_LABEL[c.status] || c.status }} · {{ rel(c.updated_at) }}</small>
          </button>
        </div>
      </div>
      <span class="hint">点击拓扑节点进入对应模块</span>
    </footer>
  </section>
</template>

<style scoped>
/* ===== 局部霓虹色板：覆盖主题变量，拓扑 canvas 读取后自动变色 ===== */
.deck {
  --brand: #3ee0ff;
  --brand-bright: #7ff0ff;
  --brand-soft: rgba(62, 224, 255, 0.12);
  --line: rgba(62, 224, 255, 0.14);
  --line-strong: rgba(62, 224, 255, 0.26);
  --line-bright: rgba(62, 224, 255, 0.55);
  --cinnabar: #ff4d6a;
  --amber: #ffb547;
  --jade: #2de0a7;
  --text-strong: #e8f6ff;
  --text: #c4d6ea;
  --text-mute: #8fa6c2;
  --text-faint: #5f7896;
  --bg-void: #050b18;
  --panel: rgba(8, 22, 44, 0.66);
  --glow: 0 0 0 1px rgba(62, 224, 255, 0.18), 0 0 24px rgba(62, 224, 255, 0.08) inset;

  position: relative; width: 100%; height: 100%; min-height: 100dvh; overflow: hidden;
  color: var(--text); font-family: var(--font-sans);
  background:
    radial-gradient(ellipse 60% 55% at 50% 52%, rgba(30, 90, 170, 0.28), transparent 70%),
    radial-gradient(ellipse 80% 60% at 50% 120%, rgba(62, 224, 255, 0.10), transparent 60%),
    linear-gradient(180deg, #040915 0%, #06122a 55%, #040a18 100%);
  display: grid;
  grid-template-columns: minmax(280px, 22vw) 1fr minmax(280px, 22vw);
  grid-template-rows: auto auto 1fr auto;
  grid-template-areas: "top top top" "kpi kpi kpi" "left core right" "feed feed feed";
  gap: 12px; padding: 14px 18px;
}
.deck.lv-critical { --threat: #ff4d6a; }
.deck.lv-elevated { --threat: #ffb547; }
.deck.lv-watch { --threat: #3ee0ff; }
.deck.lv-nominal { --threat: #2de0a7; }

.grid-bg {
  position: absolute; inset: 0; pointer-events: none; opacity: .5;
  background-image: linear-gradient(rgba(62, 224, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(62, 224, 255, 0.05) 1px, transparent 1px);
  background-size: 44px 44px;
  mask-image: radial-gradient(ellipse 75% 70% at 50% 50%, #000 40%, transparent 100%);
}
.scan { position: absolute; left: 0; right: 0; height: 120px; top: -120px; pointer-events: none;
  background: linear-gradient(180deg, transparent, rgba(62, 224, 255, 0.06), transparent); animation: scan 7s linear infinite; }
@keyframes scan { to { transform: translateY(calc(100dvh + 240px)); } }

.mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.spin { animation: spin .9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
button:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }

/* ===== 中心拓扑 ===== */
.core { grid-area: core; position: relative; min-height: 0; min-width: 0; }
.core :deep(canvas) { position: absolute; inset: 0; width: 100%; height: 100%; filter: drop-shadow(0 0 6px rgba(62, 224, 255, 0.35)); }
.core-ring { position: absolute; left: 50%; top: 52%; width: 0; height: 0; pointer-events: none; }
.core-ring i { position: absolute; left: -90px; top: -90px; width: 180px; height: 180px; border-radius: 50%;
  border: 1px dashed rgba(62, 224, 255, 0.35); animation: spin 26s linear infinite; }
.core-ring i + i { left: -130px; top: -130px; width: 260px; height: 260px; border-style: solid; border-color: transparent; border-top-color: var(--threat); border-right-color: rgba(62, 224, 255, 0.25); animation-duration: 9s; animation-direction: reverse; filter: drop-shadow(0 0 6px var(--threat)); }

/* ===== 顶栏 ===== */
.top { grid-area: top; position: relative; z-index: 2; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 16px; }
.brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
.logo { width: 34px; height: 34px; border-radius: 8px; display: grid; place-items: center; color: var(--brand); border: 1px solid var(--line-bright); background: var(--brand-soft); box-shadow: 0 0 16px rgba(62, 224, 255, 0.35); }
.brand strong { display: block; font-size: 17px; color: var(--text-strong); letter-spacing: .06em; text-shadow: 0 0 12px rgba(62, 224, 255, 0.45); }
.brand small { font-size: 10px; letter-spacing: .28em; color: var(--text-faint); }
.title-bar { display: flex; align-items: center; gap: 12px; }
.title-bar i { width: 90px; height: 1px; background: linear-gradient(90deg, transparent, var(--brand)); }
.title-bar i + span + i { background: linear-gradient(90deg, var(--brand), transparent); }
.title-bar span { font-size: 11px; letter-spacing: .22em; color: var(--brand); padding: 4px 12px; border: 1px solid var(--line-strong); border-radius: 2px; background: rgba(62, 224, 255, 0.06); }
.actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
.time { text-align: right; margin-right: 6px; }
.time b { display: block; font-size: 20px; color: var(--text-strong); letter-spacing: .06em; text-shadow: 0 0 10px rgba(62, 224, 255, 0.5); }
.time small { font-size: 11px; color: var(--text-faint); }
.icon-btn, .exit { height: 32px; border-radius: 6px; border: 1px solid var(--line-strong); background: rgba(8, 22, 44, 0.7); color: var(--text); display: inline-flex; align-items: center; justify-content: center; gap: 6px; transition: all .2s; }
.icon-btn { width: 32px; }
.exit { padding: 0 12px; font-size: 12px; }
.icon-btn:hover, .exit:hover { color: var(--brand); border-color: var(--brand); box-shadow: 0 0 12px rgba(62, 224, 255, 0.35); }
.icon-btn:disabled { opacity: .5; }

/* ===== KPI ===== */
.kpis { grid-area: kpi; position: relative; z-index: 2; display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; }
.kpi { position: relative; text-align: left; padding: 10px 14px 10px; border-radius: 6px; color: inherit; overflow: hidden;
  background: linear-gradient(180deg, rgba(62, 224, 255, 0.08), rgba(8, 22, 44, 0.6)); border: 1px solid var(--line-strong); box-shadow: var(--glow); transition: transform .2s, box-shadow .2s; }
.kpi:hover { transform: translateY(-2px); box-shadow: 0 0 0 1px var(--kc, var(--brand)), 0 0 22px color-mix(in srgb, var(--kc, var(--brand)) 35%, transparent); }
.kpi .en { display: block; font-size: 10px; letter-spacing: .2em; color: var(--text-faint); }
.kpi b { display: block; font-size: 30px; font-weight: 700; line-height: 1.15; margin: 2px 0; color: var(--kc); text-shadow: 0 0 14px color-mix(in srgb, var(--kc) 60%, transparent); }
.kpi b em { font-style: normal; font-size: 14px; margin-left: 2px; opacity: .8; }
.kpi .zh { font-size: 12px; color: var(--text-mute); }
.kpi .corner { position: absolute; right: 0; top: 0; width: 14px; height: 14px; border-top: 2px solid var(--kc); border-right: 2px solid var(--kc); opacity: .8; }
.kpi::after { content: ''; position: absolute; left: 0; bottom: 0; height: 2px; width: 100%; background: linear-gradient(90deg, var(--kc), transparent); opacity: .7; }
.t-cyan { --kc: #3ee0ff; } .t-red { --kc: #ff4d6a; } .t-amber { --kc: #ffb547; } .t-green { --kc: #2de0a7; }

/* ===== 侧栏面板 ===== */
.col { position: relative; z-index: 2; display: flex; flex-direction: column; gap: 12px; min-height: 0; min-width: 0; }
.left { grid-area: left; } .right { grid-area: right; }
.panel { position: relative; padding: 12px 14px; border-radius: 6px; background: var(--panel); border: 1px solid var(--line-strong); box-shadow: var(--glow); backdrop-filter: blur(6px); min-height: 0; }
.panel::before, .panel::after { content: ''; position: absolute; width: 10px; height: 10px; border-color: var(--brand); border-style: solid; opacity: .9; }
.panel::before { left: -1px; top: -1px; border-width: 2px 0 0 2px; }
.panel::after { right: -1px; bottom: -1px; border-width: 0 2px 2px 0; }
.panel.grow { flex: 1 1 auto; overflow: hidden; display: flex; flex-direction: column; }
.panel > header { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid var(--line); }
.h { font-size: 13px; font-weight: 600; color: var(--text-strong); padding-left: 10px; position: relative; letter-spacing: .04em; }
.h::before { content: ''; position: absolute; left: 0; top: 2px; bottom: 2px; width: 3px; background: var(--brand); box-shadow: 0 0 8px var(--brand); }
.sub { font-size: 10px; letter-spacing: .2em; color: var(--text-faint); }
.tag { font-size: 11px; padding: 2px 8px; border-radius: 2px; color: var(--threat); border: 1px solid var(--threat); box-shadow: 0 0 10px color-mix(in srgb, var(--threat) 40%, transparent); }
.link { font-size: 11px; color: var(--text-mute); }
.link:hover { color: var(--brand); }

/* 态势仪表 */
.threat { display: flex; align-items: center; gap: 14px; }
.gauge, .ring { --p: 0; position: relative; flex: none; width: 96px; height: 96px; border-radius: 50%; display: grid; place-content: center; text-align: center; }
.gauge { background: conic-gradient(var(--threat) calc(var(--p) * 1%), rgba(62, 224, 255, 0.10) 0); filter: drop-shadow(0 0 8px color-mix(in srgb, var(--threat) 50%, transparent)); }
.ring { background: conic-gradient(var(--brand) calc(var(--p) * 1%), rgba(62, 224, 255, 0.10) 0); filter: drop-shadow(0 0 8px rgba(62, 224, 255, 0.5)); }
.gauge::before, .ring::before { content: ''; position: absolute; inset: 8px; border-radius: 50%; background: #071430; border: 1px solid var(--line); }
.gauge b, .ring b, .gauge small, .ring small { position: relative; }
.gauge b, .ring b { font-size: 24px; color: var(--text-strong); line-height: 1; }
.ring b em { font-style: normal; font-size: 12px; color: var(--text-mute); }
.gauge small, .ring small { font-size: 10px; color: var(--text-faint); margin-top: 4px; }
.threat ul, .ai ul { flex: 1; display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.threat li, .ai li { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; color: var(--text-mute); }
.threat b, .ai b { color: var(--text-strong); }
.c-cyan { color: var(--brand) !important; } .c-amber { color: var(--amber) !important; } .c-mute { color: var(--text-faint) !important; }
.ai { display: flex; align-items: center; gap: 14px; }
.model { margin-top: 10px; font-size: 10px; letter-spacing: .12em; color: var(--brand); opacity: .8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* 流转 */
.f-row { width: 100%; display: grid; grid-template-columns: 76px 1fr 34px; align-items: center; gap: 8px; height: 24px; color: inherit; text-align: left; border-radius: 3px; }
.f-row:hover { background: rgba(62, 224, 255, 0.06); }
.f-label { font-size: 12px; color: var(--text-mute); }
.f-track { height: 6px; border-radius: 1px; background: rgba(62, 224, 255, 0.08); overflow: hidden; }
.f-track i { display: block; height: 100%; background: linear-gradient(90deg, rgba(62, 224, 255, 0.3), var(--brand)); box-shadow: 0 0 8px var(--brand); transition: width .6s ease; }
.f-row.peak .f-track i { background: linear-gradient(90deg, rgba(255, 77, 106, 0.3), var(--cinnabar)); box-shadow: 0 0 10px var(--cinnabar); }
.f-row.peak .f-label, .f-row.peak b { color: var(--cinnabar); }
.f-row b { font-size: 13px; text-align: right; color: var(--text-strong); }
.f-row b.zero { color: var(--text-faint); }

/* 排行 */
.bars { display: flex; flex-direction: column; gap: 9px; overflow: auto; min-height: 0; scrollbar-width: none; }
.bars li { display: grid; grid-template-columns: 20px minmax(0, 1fr) 34% 30px; align-items: center; gap: 8px; font-size: 12px; color: var(--text-mute); }
.bars li.empty { display: block; text-align: center; color: var(--text-faint); padding: 16px 0; }
.bars em { font-style: normal; font-size: 11px; color: var(--brand); opacity: .75; }
.bar { height: 6px; background: rgba(62, 224, 255, 0.08); border-radius: 1px; overflow: hidden; }
.bar u { display: block; height: 100%; background: linear-gradient(90deg, rgba(62, 224, 255, 0.3), var(--brand)); box-shadow: 0 0 8px var(--brand); }
.bar.red u { background: linear-gradient(90deg, rgba(255, 77, 106, 0.3), var(--cinnabar)); box-shadow: 0 0 8px var(--cinnabar); }
.bars b { text-align: right; color: var(--text-strong); font-size: 12px; }

/* 环形图 */
.mix { display: flex; align-items: center; gap: 14px; }
.donut { width: 104px; height: 104px; flex: none; transform: rotate(-90deg); }
.d-bg { fill: none; stroke: rgba(62, 224, 255, 0.08); stroke-width: 11; }
.d-seg { fill: none; stroke-width: 11; filter: drop-shadow(0 0 3px currentColor); transition: stroke-dasharray .6s ease; }
.legend { flex: 1; display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.legend li { display: grid; grid-template-columns: 8px 1fr auto 34px; align-items: center; gap: 8px; font-size: 12px; color: var(--text-mute); }
.legend i { width: 8px; height: 8px; border-radius: 1px; }
.legend b { color: var(--text-strong); }
.legend em { font-style: normal; font-size: 11px; color: var(--text-faint); text-align: right; }

/* ===== 底部实时流 ===== */
.feed { grid-area: feed; position: relative; z-index: 2; display: flex; align-items: center; gap: 12px; height: 40px; padding: 0 12px; border-radius: 6px; background: var(--panel); border: 1px solid var(--line-strong); box-shadow: var(--glow); overflow: hidden; }
.feed-h { flex: none; display: inline-flex; align-items: center; gap: 6px; font-size: 11px; letter-spacing: .2em; color: var(--cinnabar); }
.dot { width: 7px; height: 7px; border-radius: 50%; background: var(--cinnabar); box-shadow: 0 0 8px var(--cinnabar); animation: blink 1.4s ease-in-out infinite; }
@keyframes blink { 50% { opacity: .25; } }
.ticker { flex: 1; min-width: 0; overflow: hidden; mask-image: linear-gradient(90deg, transparent, #000 4%, #000 96%, transparent); }
.track { display: flex; gap: 28px; width: max-content; animation: ticker 60s linear infinite; }
.track.still { animation: none; }
.ticker:hover .track { animation-play-state: paused; }
@keyframes ticker { to { transform: translateX(-50%); } }
.item { display: inline-flex; align-items: center; gap: 8px; max-width: 460px; color: var(--text); font-size: 12px; white-space: nowrap; }
.item:hover span { color: var(--brand); }
.item small { color: var(--text-faint); font-size: 11px; }
.r { width: 6px; height: 6px; border-radius: 50%; flex: none; background: #5b6b8c; }
.r-high { background: var(--cinnabar); box-shadow: 0 0 6px var(--cinnabar); }
.r-medium { background: var(--amber); box-shadow: 0 0 6px var(--amber); }
.r-low { background: var(--jade); box-shadow: 0 0 6px var(--jade); }
.hint { flex: none; font-size: 11px; color: var(--text-faint); }

/* ===== 响应式 ===== */
@media (max-width: 1360px) {
  .deck { grid-template-columns: minmax(260px, 25vw) 1fr minmax(260px, 25vw); }
  .kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .title-bar { display: none; }
  .top { grid-template-columns: 1fr auto; }
}
@media (max-width: 1024px) {
  .deck { overflow-y: auto; overflow-x: hidden; max-height: 100dvh; grid-template-columns: 1fr 1fr; grid-template-rows: auto auto 380px auto auto; align-content: start;
    grid-template-areas: "top top" "kpi kpi" "core core" "left right" "feed feed"; }
  .col, .panel, .panel.grow { min-height: auto; overflow: visible; flex: none; }
  .bars { overflow: visible; }
  .hint { display: none; }
}
@media (max-width: 680px) {
  .deck { grid-template-columns: 1fr; grid-template-rows: auto auto 340px auto auto auto; grid-template-areas: "top" "kpi" "core" "left" "right" "feed"; padding: 12px; }
  .feed { height: auto; min-height: 40px; }
  .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .time, .exit span { display: none; }
  .brand small { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .scan, .core-ring i, .dot, .track, .spin { animation: none !important; }
}
</style>
