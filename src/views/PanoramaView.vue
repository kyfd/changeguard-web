<script setup lang="ts">
/* 总览：一屏回答三个问题——现在风险高不高、变更卡在哪、AI 分析有没有在工作。
   全部指标从工作区已加载数据派生，与工作台同源；无图表库，SVG/CSS 绘制。 */
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { usePanorama } from '@/composables/usePanorama'
import TechIcon from '@/components/TechIcon.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { STATUS_LABEL, fmtTime } from '@/lib/labels'

const {
  ws, total, risks, highRisk, appRanking, topRules, flow,
  pending, closed, enabledPolicies, threat, closureRate,
} = usePanorama()
const router = useRouter()
function go(name: string) { router.push({ name }) }
function open(id: string) { router.push({ name: 'change-detail', params: { id } }) }

/* ── 顶部：时钟 + 刷新 ───────────────────────────────── */
const clock = ref('')
let timer: any
function tick() { clock.value = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()) }
onMounted(() => { tick(); timer = setInterval(tick, 30_000) })
onBeforeUnmount(() => clearInterval(timer))
const refreshing = ref(false)
async function refresh() {
  refreshing.value = true
  try { await ws.load(true) } catch { /* 工作区 store 自行提示 */ } finally { refreshing.value = false }
}

/* ── 数字滚动（尊重 reduced-motion） ─────────────────── */
const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
function useCountUp(source: () => number) {
  const n = ref(0)
  let raf = 0
  watch(source, end => {
    if (reduced) { n.value = end; return }
    const start = n.value; const t0 = performance.now()
    cancelAnimationFrame(raf)
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / 600)
      n.value = Math.round(start + (end - start) * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
  }, { immediate: true })
  return n
}

const changes = computed<any[]>(() => ws.changes || [])
const failedCount = computed(() => changes.value.filter(c => c.status === 'CHECK_FAILED').length)
const blockingOpen = computed(() => changes.value.reduce((n, c) => n + (c.findings || []).filter((f: any) => f.blocking && f.status !== 'RESOLVED' && f.status !== 'VERIFIED').length, 0))

const kpis = computed(() => [
  { key: 'pending', label: '待审批', value: pending.value, note: '需要独立判断', route: 'approvals', tone: pending.value ? 'brand' : 'mute' },
  { key: 'failed', label: '检查未通过', value: failedCount.value, note: '门禁拦下待整改', route: 'changes', tone: failedCount.value ? 'red' : 'mute' },
  { key: 'high', label: '高危变更', value: highRisk.value, note: `占已加载 ${total.value ? Math.round(highRisk.value / total.value * 100) : 0}%`, route: 'risks', tone: highRisk.value ? 'red' : 'mute' },
  { key: 'blocking', label: '未关闭阻断项', value: blockingOpen.value, note: '规则 blocking finding', route: 'risks', tone: blockingOpen.value ? 'amber' : 'mute' },
  { key: 'closure', label: '通行证消费率', value: closureRate.value, suffix: '%', note: `已消费 ${closed.value} / ${total.value}`, route: 'changes', tone: 'brand' },
])
const kpiNums = kpis.value.map((_, i) => useCountUp(() => kpis.value[i].value))

/* ── 态势结论 ─────────────────────────────────────────── */
const verdict = computed(() => {
  const lvl = threat.value.level
  if (!total.value) return { title: '工作空间已就绪', body: '还没有变更单，提交第一张后这里会给出风险态势。' }
  if (lvl === 'CRITICAL') return { title: '高危占比偏高', body: `${highRisk.value} 张高危变更在途，建议先处理阻断项再推进审批。` }
  if (lvl === 'ELEVATED') return { title: '风险升高', body: `存在 ${highRisk.value} 张高危变更，优先核对规则与验证证据。` }
  if (lvl === 'WATCH') return { title: '审批待清理', body: `${pending.value} 张变更等待审批，保持审批节奏即可。` }
  return { title: '态势平稳', body: '当前已加载变更没有明显积压或高危集中。' }
})
const threatBadge = computed(() => (threat.value.level === 'NOMINAL' ? 'OK' : threat.value.level === 'CRITICAL' ? 'CRITICAL' : 'PENDING'))

/* ── 变更流转漏斗 ─────────────────────────────────────── */
const flowMax = computed(() => Math.max(1, ...flow.value.map(s => s.count)))
const bottleneck = computed(() => {
  const open = flow.value.filter(s => !s.statuses.some(st => ['COMPLETED', 'REJECTED', 'APPROVED'].includes(st)))
  const top = open.reduce((a, b) => (b.count > a.count ? b : a), open[0])
  return top && top.count > 0 ? top : null
})

/* ── 风险构成（环形图） ──────────────────────────────── */
const riskMix = computed(() => {
  const order = [
    { key: 'HIGH', label: '高危', color: 'var(--cinnabar)' },
    { key: 'MEDIUM', label: '中危', color: 'var(--amber)' },
    { key: 'LOW', label: '低危', color: 'var(--jade)' },
    { key: 'UNKNOWN', label: '未评估', color: 'var(--line-strong)' },
  ]
  const t = Math.max(1, total.value)
  return order.map(o => ({ ...o, count: risks.value[o.key] || 0, pct: Math.round((risks.value[o.key] || 0) / t * 100) }))
})
const R = 42, C = 2 * Math.PI * R
const donut = computed(() => {
  let acc = 0
  const t = Math.max(1, total.value)
  return riskMix.value.filter(m => m.count > 0).map(m => {
    const len = (m.count / t) * C
    const seg = { ...m, dash: `${Math.max(0, len - 1.5)} ${C}`, offset: -acc }
    acc += len
    return seg
  })
})

/* ── AI 分析覆盖：真实模型 vs 规则降级 ─────────────────── */
const analysis = computed(() => {
  const analysed = changes.value.filter(c => c.analysis?.provider)
  const llm = analysed.filter(c => String(c.analysis.provider).startsWith('openai-compatible') || String(c.analysis.provider).startsWith('anthropic'))
  const upgraded = llm.filter(c => rank(c.analysis.risk) > rank(c.risk))
  const tools = llm.reduce((n, c) => n + (Number(c.analysis.tool_calls) || 0), 0)
  const model = llm.find(c => c.analysis.model)?.analysis.model || ''
  return {
    analysed: analysed.length, llm: llm.length, fallback: analysed.length - llm.length,
    rate: analysed.length ? Math.round(llm.length / analysed.length * 100) : 0,
    upgraded: upgraded.length, avgTools: llm.length ? (tools / llm.length).toFixed(1) : '—', model,
  }
})
function rank(r?: string) { return ({ LOW: 1, MEDIUM: 2, HIGH: 3 } as Record<string, number>)[String(r || '').toUpperCase()] || 0 }
const modelConnected = computed(() => Boolean((ws as any).data?.config?.enterprise_llm_api) || analysis.value.llm > 0)

/* ── 服务热度 / 高频规则 / 最近高危 ─────────────────── */
const appMax = computed(() => Math.max(1, ...appRanking.value.map(a => a.count)))
const ruleMax = computed(() => Math.max(1, ...topRules.value.map(r => r.count)))
const recentHigh = computed(() => changes.value
  .filter(c => c.risk === 'HIGH' && !['COMPLETED', 'REJECTED'].includes(c.status))
  .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))
  .slice(0, 5))
</script>

<template>
  <div class="page ov">
    <!-- 页头 -->
    <div class="page-head">
      <div>
        <div class="page-kicker mono">OVERVIEW · {{ clock }}</div>
        <div class="page-title">总览</div>
        <div class="page-sub">基于已加载的 {{ total }} 张变更 · {{ ws.apps?.length || 0 }} 个服务 · {{ enabledPolicies }} 条启用规则</div>
      </div>
      <div class="page-actions">
        <button type="button" class="btn ghost" @click="go('dashboard')"><TechIcon name="gauge" :size="14" /> 工作台</button>
        <button type="button" class="btn" :disabled="refreshing" @click="refresh"><TechIcon name="refresh" :size="14" :class="{ spin: refreshing }" /> 刷新</button>
      </div>
    </div>

    <div class="scroll">
      <!-- 态势结论条 -->
      <section class="verdict" :class="'lv-' + threat.level.toLowerCase()">
        <div class="v-mark"><TechIcon :name="threat.level === 'NOMINAL' ? 'check-circle' : 'alert-triangle'" :size="18" /></div>
        <div class="v-body">
          <div class="v-title">{{ verdict.title }} <StatusBadge type="status" :value="threatBadge" size="sm">{{ threat.label }}</StatusBadge></div>
          <p>{{ verdict.body }}</p>
        </div>
        <button v-if="bottleneck" type="button" class="v-cta" @click="go(bottleneck.route)">
          积压在「{{ bottleneck.label }}」· {{ bottleneck.count }} 张 <TechIcon name="chevron-right" :size="14" />
        </button>
      </section>

      <!-- KPI -->
      <div class="kpis">
        <button v-for="(k, i) in kpis" :key="k.key" type="button" class="kpi" :class="'t-' + k.tone" @click="go(k.route)">
          <span class="k-label">{{ k.label }}</span>
          <strong class="k-val">{{ kpiNums[i] }}<em v-if="k.suffix">{{ k.suffix }}</em></strong>
          <small>{{ k.note }}</small>
        </button>
      </div>

      <div class="grid">
        <!-- 变更流转 -->
        <section class="card flow">
          <header><h3>变更流转</h3><span class="muted">各阶段当前数量</span></header>
          <button v-for="s in flow" :key="s.label" type="button" class="f-row" :class="{ peak: bottleneck && s.label === bottleneck.label }" @click="go(s.route)">
            <span class="f-label">{{ s.label }}</span>
            <span class="f-track"><i :style="{ width: (s.count / flowMax * 100) + '%' }"></i></span>
            <b :class="{ zero: !s.count }">{{ s.count }}</b>
          </button>
        </section>

        <!-- 风险构成 -->
        <section class="card risk">
          <header><h3>风险构成</h3><button type="button" class="link" @click="go('risks')">风险中心</button></header>
          <div class="donut-wrap">
            <svg viewBox="0 0 100 100" class="donut" role="img" :aria-label="`高危 ${risks.HIGH || 0}，中危 ${risks.MEDIUM || 0}，低危 ${risks.LOW || 0}`">
              <circle cx="50" cy="50" :r="R" class="d-bg" />
              <circle v-for="s in donut" :key="s.key" cx="50" cy="50" :r="R" class="d-seg" :stroke="s.color" :stroke-dasharray="s.dash" :stroke-dashoffset="s.offset" />
              <text x="50" y="48" class="d-num">{{ total }}</text>
              <text x="50" y="62" class="d-cap">张变更</text>
            </svg>
            <ul class="legend">
              <li v-for="m in riskMix" :key="m.key"><i :style="{ background: m.color }"></i><span>{{ m.label }}</span><b>{{ m.count }}</b><em>{{ m.pct }}%</em></li>
            </ul>
          </div>
        </section>

        <!-- AI 分析 -->
        <section class="card ai">
          <header>
            <h3>AI 风险分析</h3>
            <button type="button" class="link" @click="go('settings')">{{ modelConnected ? '模型设置' : '去接入模型' }}</button>
          </header>
          <div class="ai-top">
            <div class="ring" :style="{ '--p': analysis.rate }"><span>{{ analysis.rate }}<em>%</em></span></div>
            <div class="ai-meta">
              <div class="ai-line"><span>模型分析</span><b>{{ analysis.llm }}</b></div>
              <div class="ai-line"><span>规则降级</span><b class="mute">{{ analysis.fallback }}</b></div>
              <div class="ai-line"><span>AI 上调风险</span><b class="warn">{{ analysis.upgraded }}</b></div>
              <div class="ai-line"><span>平均工具调用</span><b>{{ analysis.avgTools }}</b></div>
            </div>
          </div>
          <p class="muted small">{{ analysis.model ? `当前模型 ${analysis.model} · ` : '' }}覆盖率 = 由真实模型完成分析的变更占比；模型不可用时自动降级为规则归纳。</p>
        </section>

        <!-- 服务热度 -->
        <section class="card apps">
          <header><h3>变更最多的服务</h3><button type="button" class="link" @click="go('apps')">全部服务</button></header>
          <ul class="bars">
            <li v-for="a in appRanking" :key="a.name">
              <span class="ellipsis">{{ a.name }}</span>
              <i class="bar"><em :style="{ width: (a.count / appMax * 100) + '%' }"></em></i>
              <b>{{ a.count }}</b>
            </li>
            <li v-if="!appRanking.length" class="empty">暂无服务数据</li>
          </ul>
        </section>

        <!-- 高频规则 -->
        <section class="card rules">
          <header><h3>高频命中规则</h3><button type="button" class="link" @click="go('policies')">检查规则</button></header>
          <ul class="bars">
            <li v-for="r in topRules" :key="r.code" :title="r.code">
              <span class="ellipsis"><i class="sev" :class="'s-' + String(r.severity).toLowerCase()"></i>{{ r.title }}</span>
              <i class="bar"><em class="red" :style="{ width: (r.count / ruleMax * 100) + '%' }"></em></i>
              <b>{{ r.count }}</b>
            </li>
            <li v-if="!topRules.length" class="empty">暂无规则命中</li>
          </ul>
        </section>

        <!-- 在途高危 -->
        <section class="card hot">
          <header><h3>在途高危</h3><span class="muted">{{ recentHigh.length }} 张</span></header>
          <button v-for="c in recentHigh" :key="c.id" type="button" class="h-row" @click="open(c.id)">
            <div class="h-main">
              <strong class="ellipsis">{{ c.title || '未命名变更' }}</strong>
              <small>{{ c.application_name || '未归属服务' }} · {{ STATUS_LABEL[c.status] || c.status }} · {{ fmtTime(c.updated_at) }}</small>
            </div>
            <TechIcon name="chevron-right" :size="14" />
          </button>
          <div v-if="!recentHigh.length" class="empty">没有在途高危变更</div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import './page.css';
.ov { overflow: hidden; }
.scroll { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding-bottom: var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-3); }
.muted { color: var(--text-faint); font-size: var(--fs-12); }
.muted.small { font-size: var(--fs-11); line-height: 1.5; }
.ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }

.page-actions { display: flex; gap: var(--sp-2); }
.btn { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 12px; border-radius: var(--r); border: 1px solid var(--brand); background: var(--brand); color: var(--text-inverse); font-size: var(--fs-12); font-weight: var(--fw-medium); }
.btn.ghost { background: var(--surface); color: var(--text-strong); border-color: var(--line-strong); }
.btn:hover { filter: brightness(1.05); }
.btn.ghost:hover { background: var(--bg-elev); filter: none; }
.btn:disabled { opacity: .6; }
.spin { animation: spin 0.9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.btn:focus-visible, .kpi:focus-visible, .link:focus-visible, .f-row:focus-visible, .h-row:focus-visible, .v-cta:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }

/* 态势结论 */
.verdict { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-3) var(--sp-4); border-radius: var(--r-lg); border: 1px solid var(--line); background: var(--surface); box-shadow: var(--shadow-card); position: relative; overflow: hidden; }
.verdict::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--jade); }
.verdict.lv-critical::before { background: var(--cinnabar); }
.verdict.lv-elevated::before { background: var(--amber); }
.verdict.lv-watch::before { background: var(--brand); }
.v-mark { width: 34px; height: 34px; border-radius: var(--r); display: grid; place-items: center; flex: none; background: var(--jade-soft); color: var(--jade); }
.lv-critical .v-mark { background: var(--cinnabar-soft); color: var(--cinnabar); }
.lv-elevated .v-mark { background: var(--amber-soft); color: var(--amber); }
.lv-watch .v-mark { background: var(--brand-soft); color: var(--brand); }
.v-body { flex: 1; min-width: 0; }
.v-title { display: flex; align-items: center; gap: var(--sp-2); font-size: var(--fs-14); font-weight: var(--fw-semibold); color: var(--text-strong); }
.v-body p { margin: 2px 0 0; font-size: var(--fs-12); color: var(--text-mute); }
.v-cta { flex: none; display: inline-flex; align-items: center; gap: 4px; height: 30px; padding: 0 12px; border-radius: var(--r); border: 1px solid var(--line-strong); background: var(--surface-2); color: var(--text-strong); font-size: var(--fs-12); }
.v-cta:hover { border-color: var(--line-bright); color: var(--brand); }

/* KPI */
.kpis { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: var(--sp-3); }
.kpi { text-align: left; padding: var(--sp-3) var(--sp-4); border-radius: var(--r-lg); background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow-card); color: inherit; transition: background var(--dur-fast), transform var(--dur-fast); }
.kpi:hover { background: var(--bg-elev); transform: translateY(-1px); }
.k-label { display: block; font-family: var(--font-mono); font-size: var(--fs-11); letter-spacing: 0.12em; color: var(--text-faint); margin-bottom: 8px; }
.k-val { display: block; font-size: var(--fs-24); font-weight: var(--fw-semibold); line-height: var(--lh-tight); font-variant-numeric: tabular-nums; letter-spacing: -0.01em; color: var(--brand); }
.k-val em { font-style: normal; font-size: var(--fs-13); margin-left: 2px; color: var(--text-mute); }
.kpi small { display: block; margin-top: 4px; font-size: var(--fs-11); color: var(--text-faint); }
.t-red .k-val { color: var(--cinnabar); }
.t-amber .k-val { color: var(--amber); }
.t-mute .k-val { color: var(--text-faint); }

/* 卡片栅格：12 列 */
.grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: var(--sp-3); }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); box-shadow: var(--shadow-card); padding: var(--sp-3) var(--sp-4) var(--sp-4); min-width: 0; display: flex; flex-direction: column; }
:root[data-theme="light"] .card, :root[data-theme="light"] .kpi, :root[data-theme="light"] .verdict { box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6), var(--shadow-card); }
.card > header { display: flex; align-items: baseline; justify-content: space-between; gap: var(--sp-2); margin-bottom: var(--sp-3); }
.card h3 { font-size: var(--fs-13); font-weight: var(--fw-semibold); color: var(--text-strong); }
.link { font-size: var(--fs-12); color: var(--text-faint); }
.link:hover { color: var(--brand); }
.flow { grid-column: span 5; }
.risk { grid-column: span 3; }
.ai { grid-column: span 4; }
.apps { grid-column: span 4; }
.rules { grid-column: span 4; }
.hot { grid-column: span 4; }
.empty { display: grid; place-items: center; min-height: 80px; color: var(--text-faint); font-size: var(--fs-12); }

/* 流转 */
.f-row { width: 100%; display: grid; grid-template-columns: 84px 1fr 32px; align-items: center; gap: var(--sp-2); height: 30px; padding: 0 6px; margin: 0 -6px; border-radius: var(--r-sm); color: inherit; text-align: left; }
.f-row:hover { background: var(--bg-elev); }
.f-label { font-size: var(--fs-12); color: var(--text-mute); }
.f-track { height: 8px; border-radius: 4px; background: var(--surface-2); overflow: hidden; }
.f-track i { display: block; height: 100%; min-width: 2px; background: var(--brand); border-radius: 4px; transition: width var(--dur) var(--ease); }
.f-row.peak .f-track i { background: var(--cinnabar); }
.f-row.peak .f-label { color: var(--text-strong); font-weight: var(--fw-medium); }
.f-row b { font-size: var(--fs-13); font-family: var(--font-mono); text-align: right; font-variant-numeric: tabular-nums; color: var(--text-strong); }
.f-row.peak b { color: var(--cinnabar); }
.f-row b.zero { color: var(--text-faint); }

/* 环形图 */
.donut-wrap { display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); }
.donut { width: 132px; height: 132px; transform: rotate(-90deg); }
.d-bg { fill: none; stroke: var(--surface-2); stroke-width: 12; }
.d-seg { fill: none; stroke-width: 12; transition: stroke-dasharray var(--dur) var(--ease); }
.d-num, .d-cap { transform: rotate(90deg); transform-origin: 50px 50px; text-anchor: middle; fill: var(--text-strong); }
.d-num { font-size: 18px; font-weight: 600; font-family: var(--font-sans); }
.d-cap { font-size: 8px; fill: var(--text-faint); }
.legend { width: 100%; display: flex; flex-direction: column; gap: 4px; }
.legend li { display: grid; grid-template-columns: 8px 1fr auto 36px; align-items: center; gap: var(--sp-2); font-size: var(--fs-12); color: var(--text-mute); }
.legend i { width: 8px; height: 8px; border-radius: 2px; }
.legend b { font-family: var(--font-mono); color: var(--text-strong); font-variant-numeric: tabular-nums; }
.legend em { font-style: normal; font-family: var(--font-mono); font-size: var(--fs-11); color: var(--text-faint); text-align: right; }

/* AI 覆盖 */
.ai-top { display: flex; align-items: center; gap: var(--sp-4); margin-bottom: var(--sp-3); }
.ring { --p: 0; width: 96px; height: 96px; flex: none; border-radius: 50%; display: grid; place-items: center;
  background: conic-gradient(var(--brand) calc(var(--p) * 1%), var(--surface-2) 0); position: relative; }
.ring::before { content: ''; position: absolute; inset: 10px; border-radius: 50%; background: var(--surface); }
.ring span { position: relative; font-size: var(--fs-20); font-weight: var(--fw-semibold); color: var(--text-strong); font-variant-numeric: tabular-nums; }
.ring em { font-style: normal; font-size: var(--fs-11); color: var(--text-faint); margin-left: 1px; }
.ai-meta { flex: 1; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.ai-line { display: flex; justify-content: space-between; font-size: var(--fs-12); color: var(--text-mute); }
.ai-line b { font-family: var(--font-mono); color: var(--text-strong); font-variant-numeric: tabular-nums; }
.ai-line b.mute { color: var(--text-faint); }
.ai-line b.warn { color: var(--amber); }

/* 横条列表 */
.bars { display: flex; flex-direction: column; gap: 10px; }
.bars li { display: grid; grid-template-columns: minmax(0, 1fr) 38% 28px; align-items: center; gap: var(--sp-2); font-size: var(--fs-12); color: var(--text-mute); }
.bars li.empty { display: grid; grid-template-columns: 1fr; }
.bar { height: 6px; border-radius: 3px; background: var(--surface-2); overflow: hidden; }
.bar em { display: block; height: 100%; background: var(--brand); border-radius: 3px; }
.bar em.red { background: var(--cinnabar); }
.bars b { font-family: var(--font-mono); text-align: right; color: var(--text-strong); font-variant-numeric: tabular-nums; }
.sev { display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 6px; vertical-align: middle; background: var(--line-strong); }
.s-high { background: var(--cinnabar); }
.s-medium { background: var(--amber); }
.s-low { background: var(--jade); }

/* 在途高危 */
.h-row { width: 100%; display: flex; align-items: center; gap: var(--sp-2); padding: 8px 6px; margin: 0 -6px; border-radius: var(--r-sm); color: var(--text-faint); text-align: left; border-bottom: 1px solid var(--line); }
.h-row:last-of-type { border-bottom: 0; }
.h-row:hover { background: var(--bg-elev); color: var(--brand); }
.h-main { flex: 1; min-width: 0; }
.h-main strong { display: block; font-size: var(--fs-12); color: var(--text-strong); font-weight: var(--fw-medium); }
.h-main small { display: block; font-size: var(--fs-11); color: var(--text-faint); margin-top: 2px; }

@media (max-width: 1280px) {
  .kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .flow { grid-column: span 7; } .risk { grid-column: span 5; }
  .ai, .apps { grid-column: span 6; } .rules, .hot { grid-column: span 6; }
}
@media (max-width: 860px) {
  .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .grid > .card { grid-column: 1 / -1; }
  .verdict { flex-wrap: wrap; }
  .v-cta { width: 100%; justify-content: center; }
}
@media (prefers-reduced-motion: reduce) {
  .kpi, .f-track i, .d-seg { transition: none; }
  .spin { animation: none; }
}
</style>
