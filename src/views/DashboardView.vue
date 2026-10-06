<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkspaceStore } from '@/stores/workspace.ts'
import { api } from '@/api/client.ts'
import TechIcon from '@/components/TechIcon.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import NeonButton from '@/components/NeonButton.vue'
import { ownerOf, fmtTime, consumptionStats, STATUS_LABEL } from '@/lib/labels.ts'

const ws = useWorkspaceStore()
const router = useRouter()

const pending = computed(() => ws.changes.filter((c) => c.status === 'WAITING_APPROVAL'))
const failed = computed(() => ws.changes.filter((c) => c.status === 'CHECK_FAILED'))
const high = computed(() =>
  ws.changes.filter((c) => c.risk === 'HIGH' && !['APPROVED', 'COMPLETED', 'REJECTED'].includes(c.status))
)
const recent = computed(() =>
  [...ws.changes]
    .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
    .slice(0, 7)
)
const consumption = computed(() => consumptionStats(ws.changes))

/* 待办按紧急度合并 */
const inbox = computed(() => {
  const seen = new Set<string>()
  const out: { c: any; kind: string; tone: 'wait' | 'fail' | 'risk' }[] = []
  for (const c of pending.value) {
    if (seen.has(c.id)) continue
    seen.add(c.id)
    out.push({ c, kind: '待审批', tone: 'wait' })
  }
  for (const c of failed.value) {
    if (seen.has(c.id)) continue
    seen.add(c.id)
    out.push({ c, kind: '检查未通过', tone: 'fail' })
  }
  for (const c of high.value) {
    if (seen.has(c.id)) continue
    seen.add(c.id)
    out.push({ c, kind: '高危待处理', tone: 'risk' })
  }
  return out
})

function open(id: string) {
  router.push({ name: 'change-detail', params: { id } })
}

function openDeck() {
  router.push({ name: 'panorama' })
}

/* 变更趋势 */
const trends = ref<any[]>([])
const trendsLoaded = ref(false)

onMounted(async () => {
  try {
    const data = await api.trends(6)
    trends.value = Array.isArray(data) ? data : []
  } catch {}
  trendsLoaded.value = true
})

const hasTrends = computed(() => trendsLoaded.value && trends.value.some((t: any) => (t.submitted || 0) > 0))

/* 纯粹高对比度曲线算法 */
function generateTrendPoints(getter: (t: any) => number | null, width = 240, height = 54) {
  const values = trends.value.map((t) => getter(t))
  const pts = values
    .map((v, i) => (v == null ? null : { x: i, y: v, v }))
    .filter(Boolean) as { x: number; y: number; v: number }[]
  if (pts.length < 3) return null

  const lo = Math.min(...pts.map((p) => p.v))
  const hi = Math.max(...pts.map((p) => p.v))
  const span = hi - lo || 1
  const pad = 6
  const usableH = height - pad * 2
  const step = width / (trends.value.length - 1 || 1)

  const coords = pts.map((p) => ({
    x: p.x * step,
    y: pad + ((hi - p.v) / span) * usableH,
    v: p.v,
  }))

  const lineD = coords.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const lastX = coords[coords.length - 1].x.toFixed(1)
  const firstX = coords[0].x.toFixed(1)
  const areaD = `${lineD} L ${lastX},${height} L ${firstX},${height} Z`

  return { lineD, areaD, dots: coords }
}

const submittedBars = computed(() => {
  const max = Math.max(...trends.value.map((t: any) => t.submitted || 0), 1)
  return trends.value.map((t: any) => ({
    label: String(t.month || '').slice(5),
    done: t.completed || 0,
    rejected: t.rejected || 0,
    flying: t.in_flight || 0,
    total: t.submitted || 0,
    doneH: ((t.completed || 0) / max) * 100,
    rejectedH: ((t.rejected || 0) / max) * 100,
    flyingH: ((t.in_flight || 0) / max) * 100,
  }))
})

const rejectionChart = computed(() =>
  generateTrendPoints((t) => (t.rejection_rate == null || t.rejection_rate < 0 ? null : (t.rejection_rate as number) * 100))
)
const highRiskChart = computed(() =>
  generateTrendPoints((t) => (t.high_risk_rate == null || t.high_risk_rate < 0 ? null : (t.high_risk_rate as number) * 100))
)
const approvalChart = computed(() =>
  generateTrendPoints((t) => (t.approval_hours == null || t.approval_hours < 0 ? null : (t.approval_hours as number)))
)

function lastValueWithMonth(getter: (t: any) => number | null, unit = '') {
  for (let i = trends.value.length - 1; i >= 0; i--) {
    const month = trends.value[i]
    const v = getter(month)
    if (v != null && v >= 0) {
      const text = unit === '%' ? `${Math.round(v * 100)}%` : `${Math.round(v * 10) / 10}${unit}`
      return { text, month: String(month.month || ''), isLatest: i === trends.value.length - 1 }
    }
  }
  return { text: '—', month: '', isLatest: false }
}

const rejectionValue = computed(() => lastValueWithMonth((t) => (t.rejection_rate < 0 ? null : t.rejection_rate), '%'))
const highRiskValue = computed(() => lastValueWithMonth((t) => (t.high_risk_rate < 0 ? null : t.high_risk_rate), '%'))
const approvalValue = computed(() => lastValueWithMonth((t) => (t.approval_hours < 0 ? null : t.approval_hours)))
</script>

<template>
  <div class="dashboard-viewport">
    <!-- 顶部干净利落的态势顶栏 -->
    <header class="dash-hero">
      <div>
        <div class="page-kicker mono">CONTROL ENGINE · ACTIVE</div>
        <h1 class="hero-title">
          工作台概览
          <span class="sub-counter mono">({{ ws.changes.length }} 笔活跃工单)</span>
        </h1>
        <p class="hero-sub">全量变更检查与通行证防御控制，确保线上生产高可用</p>
      </div>

      <div class="hero-actions">
        <NeonButton variant="ghost" size="md" @click="openDeck">
          <TechIcon name="activity" :size="16" /> 全景指挥室
        </NeonButton>
        <NeonButton variant="ghost" size="md" @click="ws.load(true).catch(() => {})">
          <TechIcon name="refresh" :size="15" /> 刷新数据
        </NeonButton>
      </div>
    </header>

    <!-- 顶部核心 KPI 卡片 (纯白底、深黑粗字、高对比度) -->
    <section class="kpi-grid">
      <div
        class="kpi-card"
        :class="{ 'has-action': pending.length > 0 }"
        @click="router.push({ name: 'approvals' })"
      >
        <div class="kpi-card-head">
          <span class="kpi-tag mono">AWAITING REVIEW</span>
          <span v-if="pending.length" class="kpi-badge-alert">待处置</span>
        </div>
        <div class="kpi-num">{{ pending.length }}</div>
        <div class="kpi-title">待审批门禁单</div>
        <p class="kpi-desc">阻断拦截生效中，需要独立审核确认</p>
      </div>

      <div
        class="kpi-card"
        :class="{ 'has-danger': failed.length > 0 }"
        @click="router.push({ name: 'changes' })"
      >
        <div class="kpi-card-head">
          <span class="kpi-tag mono">CHECK FAILED</span>
        </div>
        <div class="kpi-num err">{{ failed.length }}</div>
        <div class="kpi-title">检查未通过</div>
        <p class="kpi-desc">规则不符，已被系统自动阻断拦截</p>
      </div>

      <div
        class="kpi-card"
        :class="{ 'has-warn': high.length > 0 }"
        @click="router.push({ name: 'risks' })"
      >
        <div class="kpi-card-head">
          <span class="kpi-tag mono">HIGH RISK</span>
        </div>
        <div class="kpi-num warn">{{ high.length }}</div>
        <div class="kpi-title">高危待处理</div>
        <p class="kpi-desc">涉及锁表或全表风险的敏感数据库变更</p>
      </div>

      <div class="kpi-card" @click="router.push({ name: 'changes' })">
        <div class="kpi-card-head">
          <span class="kpi-tag mono">CONSUMED RATIO</span>
          <span class="kpi-ratio-text mono">{{ consumption.consumed }}/{{ consumption.total }}</span>
        </div>
        <div class="kpi-num brand">{{ consumption.percent }}<small>%</small></div>
        <div class="kpi-title">通行证消费履约率</div>
        <div class="clean-progress-bar">
          <div class="progress-fill" :style="{ width: consumption.percent + '%' }"></div>
        </div>
        <p class="kpi-desc">已加载变更中被 CI/CD 正式消费的比例</p>
      </div>
    </section>

    <!-- 治理趋势深度态势中心 (彻底修复对比度：白底卡片、清晰黑色标题、利落图表) -->
    <section v-if="hasTrends" class="trends-panel">
      <div class="trends-head">
        <div>
          <h3>变更趋势分析</h3>
          <span class="trends-meta mono">近 {{ trends.length }} 个自然月 · UTC+8 权威审计口径</span>
        </div>
        <div class="trends-legend">
          <span class="legend-item"><i class="dot-brand"></i>已消费</span>
          <span class="legend-item"><i class="dot-red"></i>已拒绝</span>
          <span class="legend-item"><i class="dot-gray"></i>推进中</span>
        </div>
      </div>

      <div class="trends-cards-grid">
        <!-- 柱状图: 月度提交量 -->
        <div class="trend-card">
          <div class="trend-card-title">月度提交量与处理流</div>
          <div class="bars-container">
            <div
              v-for="b in submittedBars"
              :key="b.label"
              class="bar-column"
              :title="`${b.label} 月：提交 ${b.total}（消费 ${b.done} / 拒绝 ${b.rejected} / 推进中 ${b.flying}）`"
            >
              <div class="bar-slot">
                <i class="seg-flying" :style="{ height: b.flyingH + '%' }"></i>
                <i class="seg-rejected" :style="{ height: b.rejectedH + '%' }"></i>
                <i class="seg-done" :style="{ height: b.doneH + '%' }"></i>
              </div>
              <span class="bar-month mono">{{ b.label }}</span>
            </div>
          </div>
        </div>

        <!-- 曲线图 1: 拒绝率 -->
        <div class="trend-card">
          <div class="trend-card-title">定局拒绝率</div>
          <div class="metric-row">
            <span class="metric-big-num err mono">{{ rejectionValue.text }}</span>
            <span class="month-pill mono">
              {{
                rejectionValue.month
                  ? (rejectionValue.isLatest ? rejectionValue.month + ' 当月' : rejectionValue.month + ' 月')
                  : '无样本'
              }}
            </span>
          </div>
          <div class="spark-wrapper">
            <svg v-if="rejectionChart" viewBox="0 0 240 54" preserveAspectRatio="none">
              <defs>
                <linearGradient id="fill-red" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#e11d48" stop-opacity="0.12" />
                  <stop offset="100%" stop-color="#e11d48" stop-opacity="0.0" />
                </linearGradient>
              </defs>
              <path :d="rejectionChart.areaD" fill="url(#fill-red)" />
              <path :d="rejectionChart.lineD" fill="none" stroke="#e11d48" stroke-width="2" />
              <circle
                v-for="(p, i) in rejectionChart.dots"
                :key="i"
                :cx="p.x"
                :cy="p.y"
                r="3"
                fill="#ffffff"
                stroke="#e11d48"
                stroke-width="2"
              />
            </svg>
            <div v-else class="empty-hint">连续样本不足 3 个月</div>
          </div>
        </div>

        <!-- 曲线图 2: 高危占比 -->
        <div class="trend-card">
          <div class="trend-card-title">高危变更占比</div>
          <div class="metric-row">
            <span class="metric-big-num warn mono">{{ highRiskValue.text }}</span>
            <span class="month-pill mono">
              {{
                highRiskValue.month
                  ? (highRiskValue.isLatest ? highRiskValue.month + ' 当月' : highRiskValue.month + ' 月')
                  : '无样本'
              }}
            </span>
          </div>
          <div class="spark-wrapper">
            <svg v-if="highRiskChart" viewBox="0 0 240 54" preserveAspectRatio="none">
              <defs>
                <linearGradient id="fill-amber" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#d97706" stop-opacity="0.12" />
                  <stop offset="100%" stop-color="#d97706" stop-opacity="0.0" />
                </linearGradient>
              </defs>
              <path :d="highRiskChart.areaD" fill="url(#fill-amber)" />
              <path :d="highRiskChart.lineD" fill="none" stroke="#d97706" stroke-width="2" />
              <circle
                v-for="(p, i) in highRiskChart.dots"
                :key="i"
                :cx="p.x"
                :cy="p.y"
                r="3"
                fill="#ffffff"
                stroke="#d97706"
                stroke-width="2"
              />
            </svg>
            <div v-else class="empty-hint">连续样本不足 3 个月</div>
          </div>
        </div>

        <!-- 曲线图 3: 平均决策耗时 -->
        <div class="trend-card">
          <div class="trend-card-title">平均签署决策耗时</div>
          <div class="metric-row">
            <span class="metric-big-num brand mono">{{ approvalValue.text }}<small>h</small></span>
            <span class="month-pill mono">
              {{
                approvalValue.month
                  ? (approvalValue.isLatest ? approvalValue.month + ' 当月' : approvalValue.month + ' 月')
                  : '无样本'
              }}
            </span>
          </div>
          <div class="spark-wrapper">
            <svg v-if="approvalChart" viewBox="0 0 240 54" preserveAspectRatio="none">
              <defs>
                <linearGradient id="fill-brand" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#4338ca" stop-opacity="0.12" />
                  <stop offset="100%" stop-color="#4338ca" stop-opacity="0.0" />
                </linearGradient>
              </defs>
              <path :d="approvalChart.areaD" fill="url(#fill-brand)" />
              <path :d="approvalChart.lineD" fill="none" stroke="#4338ca" stroke-width="2" />
              <circle
                v-for="(p, i) in approvalChart.dots"
                :key="i"
                :cx="p.x"
                :cy="p.y"
                r="3"
                fill="#ffffff"
                stroke="#4338ca"
                stroke-width="2"
              />
            </svg>
            <div v-else class="empty-hint">连续样本不足 3 个月</div>
          </div>
        </div>
      </div>
    </section>

    <!-- 底部双列清爽工单流 -->
    <section class="split-flow-grid">
      <!-- 待处理工单列表 -->
      <div class="flow-panel">
        <div class="flow-head">
          <div class="flow-title">
            <TechIcon name="gauge" :size="16" />
            <span>待处理行动流</span>
            <span class="badge-count mono">{{ inbox.length }}</span>
          </div>
          <button class="link-btn" type="button" @click="router.push({ name: 'approvals' })">
            全部审批 →
          </button>
        </div>

        <div class="flow-items">
          <div
            v-for="it in inbox"
            :key="it.c.id"
            class="flow-card"
            @click="open(it.c.id)"
          >
            <span class="flow-tag mono" :class="it.tone">{{ it.kind }}</span>
            <div class="flow-body">
              <div class="flow-card-title">{{ it.c.title || it.c.summary || '未命名变更单' }}</div>
              <div class="flow-card-meta">
                <span>{{ it.c.application_name || '主应用' }}</span>
                <span>·</span>
                <span>{{ ownerOf(it.c) }}</span>
                <span>·</span>
                <span class="mono">{{ fmtTime(it.c.updated_at) }}</span>
              </div>
            </div>
            <StatusBadge type="risk" :value="it.c.risk" size="sm" />
          </div>

          <div v-if="!inbox.length" class="empty-flow">
            <TechIcon name="check-circle" :size="32" />
            <p>当前所有门禁检查均已完成，无待办事项</p>
          </div>
        </div>
      </div>

      <!-- 最近流转轨迹 -->
      <div class="flow-panel">
        <div class="flow-head">
          <div class="flow-title">
            <TechIcon name="scroll-text" :size="16" />
            <span>最近变更轨迹</span>
          </div>
          <button class="link-btn" type="button" @click="router.push({ name: 'changes' })">
            全部变更 →
          </button>
        </div>

        <div class="flow-items">
          <div
            v-for="c in recent"
            :key="c.id"
            class="flow-card"
            @click="open(c.id)"
          >
            <StatusBadge type="status" :value="c.status" size="sm">
              {{ STATUS_LABEL[c.status] || c.status }}
            </StatusBadge>
            <div class="flow-body">
              <div class="flow-card-title">{{ c.title || c.summary || '未命名变更单' }}</div>
              <div class="flow-card-meta">
                <span class="mono">{{ String(c.id).slice(0, 8) }}</span>
                <span>·</span>
                <span>{{ c.application_name || '服务变更' }}</span>
                <span>·</span>
                <span class="mono">{{ fmtTime(c.updated_at) }}</span>
              </div>
            </div>
          </div>

          <div v-if="!recent.length" class="empty-flow">
            <TechIcon name="code" :size="32" />
            <p>暂无变更记录，等待提交产生</p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.dashboard-viewport {
  width: 100%;
  height: 100%;
  padding: 28px 36px 40px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 28px;
  box-sizing: border-box;
}

@media (max-width: 880px) {
  .dashboard-viewport {
    padding: 20px 16px 32px;
    gap: 20px;
  }
}

/* 顶部态势标题 */
.dash-hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.page-kicker {
  font-size: 11px;
  font-weight: 600;
  color: var(--brand);
  background: var(--brand-soft);
  padding: 2px 8px;
  border-radius: var(--r-pill);
  display: inline-block;
  margin-bottom: 6px;
  letter-spacing: 0.12em;
}

.hero-title {
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--text-strong);
  margin: 0;
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.sub-counter {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-faint);
}

.hero-sub {
  margin-top: 4px;
  font-size: 13px;
  color: var(--text-mute);
}

.hero-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* KPI 卡片网格 (高对比度纯白底) */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 18px;
}
@media (max-width: 1080px) {
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 640px) {
  .kpi-grid { grid-template-columns: 1fr; }
}

.kpi-card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-xl);
  padding: 22px;
  box-shadow: var(--shadow-card);
  transition: all var(--dur) var(--ease);
  cursor: pointer;
}
.kpi-card:hover {
  transform: translateY(-2px);
  border-color: var(--line-strong);
  box-shadow: var(--shadow-panel);
}

.kpi-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.kpi-tag {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: var(--text-faint);
}

.kpi-badge-alert {
  font-size: 10px;
  background: var(--cinnabar-soft);
  color: var(--cinnabar);
  font-weight: 600;
  padding: 1px 7px;
  border-radius: var(--r-pill);
}

.kpi-ratio-text {
  font-size: 12px;
  color: var(--text-mute);
  font-weight: 600;
}

.kpi-num {
  font-size: 36px;
  font-weight: 800;
  letter-spacing: -0.04em;
  line-height: 1;
  color: var(--text-strong);
  margin-bottom: 6px;
  font-variant-numeric: tabular-nums;
}
.kpi-num.err { color: var(--cinnabar); }
.kpi-num.warn { color: var(--amber); }
.kpi-num.brand { color: var(--brand); }
.kpi-num small { font-size: 16px; font-weight: 500; margin-left: 2px; }

.kpi-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-strong);
  margin-bottom: 4px;
}

.kpi-desc {
  font-size: 12px;
  color: var(--text-mute);
  line-height: 1.45;
  margin: 0;
}

.clean-progress-bar {
  height: 6px;
  border-radius: var(--r-pill);
  background: var(--surface-sunken);
  border: 1px solid var(--line);
  margin: 8px 0;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  border-radius: var(--r-pill);
  background: var(--brand);
  transition: width 0.4s var(--ease);
}

/* 治理趋势深度面板 (彻底修复对比度：白底卡片、清晰黑色标题) */
.trends-panel {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-xl);
  padding: 24px;
  box-shadow: var(--shadow-card);
}

.trends-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--line);
  flex-wrap: wrap;
  gap: 12px;
}

.trends-head h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-strong);
}

.trends-meta {
  font-size: 11px;
  color: var(--text-faint);
  margin-top: 2px;
  display: block;
}

.trends-legend {
  display: flex;
  align-items: center;
  gap: 16px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-mute);
  font-weight: 500;
}
.legend-item i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.dot-brand { background: var(--brand); }
.dot-red { background: var(--cinnabar); }
.dot-gray { background: var(--line-strong); }

.trends-cards-grid {
  display: grid;
  grid-template-columns: 1.3fr 1fr 1fr 1fr;
  gap: 16px;
}
@media (max-width: 1080px) {
  .trends-cards-grid { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 640px) {
  .trends-cards-grid { grid-template-columns: 1fr; }
}

/* 卡片样式：纯白底/浅色底，严禁浑浊水泥灰！ */
.trend-card {
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  transition: all var(--dur-fast);
}
.trend-card:hover {
  border-color: var(--line-strong);
}

.trend-card-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-strong);
  letter-spacing: -0.01em;
}

.metric-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-top: 6px;
  margin-bottom: 8px;
}

.metric-big-num {
  font-size: 28px;
  font-weight: 800;
  color: var(--text-strong);
  letter-spacing: -0.03em;
  line-height: 1;
}
.metric-big-num.err { color: var(--cinnabar); }
.metric-big-num.warn { color: var(--amber); }
.metric-big-num.brand { color: var(--brand); }
.metric-big-num small { font-size: 14px; font-weight: 500; color: var(--text-mute); }

/* 月份指示标签：白底细边，清晰深色文字，告别黑糊一团！ */
.month-pill {
  font-size: 11px;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--line-strong);
  padding: 2px 7px;
  border-radius: var(--r-sm);
  font-weight: 600;
}

.spark-wrapper {
  width: 100%;
  height: 54px;
}
.spark-wrapper svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.empty-hint {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--text-faint);
  background: var(--surface);
  border: 1px dashed var(--line-strong);
  border-radius: var(--r-sm);
}

/* 柱状流 */
.bars-container {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  height: 78px;
  margin-top: 10px;
}
.bar-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
}
.bar-slot {
  flex: 1;
  width: 100%;
  max-width: 22px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  border-radius: 4px;
  overflow: hidden;
  background: var(--line);
}
.seg-done { background: var(--brand); }
.seg-rejected { background: var(--cinnabar); }
.seg-flying { background: var(--line-strong); }
.bar-month {
  margin-top: 6px;
  font-size: 10px;
  color: var(--text-faint);
  font-weight: 600;
}

/* 底部双列清爽工单流 */
.split-flow-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
@media (max-width: 900px) {
  .split-flow-grid { grid-template-columns: 1fr; }
}

.flow-panel {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-xl);
  padding: 22px;
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
}

.flow-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--line);
}

.flow-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-strong);
}

.badge-count {
  font-size: 11px;
  background: var(--brand-soft);
  color: var(--brand);
  padding: 1px 7px;
  border-radius: var(--r-pill);
  font-weight: 700;
}

.link-btn {
  font-size: 12px;
  color: var(--brand);
  font-weight: 600;
  cursor: pointer;
}
.link-btn:hover {
  text-decoration: underline;
}

.flow-items {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.flow-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: var(--r);
  background: var(--surface-2);
  border: 1px solid var(--line);
  cursor: pointer;
  transition: all var(--dur-fast);
}
.flow-card:hover {
  background: var(--bg-elev);
  border-color: var(--line-strong);
}

.flow-tag {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: var(--r-xs);
  flex-shrink: 0;
}
.flow-tag.wait { color: var(--brand); background: var(--brand-soft); }
.flow-tag.fail { color: var(--cinnabar); background: var(--cinnabar-soft); }
.flow-tag.risk { color: var(--amber); background: var(--amber-soft); }

.flow-body {
  flex: 1;
  min-width: 0;
}

.flow-card-title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-strong);
  margin-bottom: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.flow-card-meta {
  font-size: 12px;
  color: var(--text-faint);
  display: flex;
  align-items: center;
  gap: 6px;
}

.empty-flow {
  text-align: center;
  padding: 40px 16px;
  color: var(--text-faint);
}
.empty-flow svg {
  margin: 0 auto 10px;
  opacity: 0.4;
}
.empty-flow p {
  font-size: 13px;
  margin: 0;
}
</style>
