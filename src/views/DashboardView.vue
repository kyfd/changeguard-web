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

/* 平滑面积折线图算法：生成带贝塞尔平滑光晕的 SVG path */
function generateSmoothCurve(getter: (t: any) => number | null, width = 220, height = 56) {
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

  // 构建平滑贝塞尔曲线路径
  let d = `M ${coords[0].x.toFixed(1)},${coords[0].y.toFixed(1)}`
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i]
    const p1 = coords[i + 1]
    const mx = (p0.x + p1.x) / 2
    d += ` C ${mx.toFixed(1)},${p0.y.toFixed(1)} ${mx.toFixed(1)},${p1.y.toFixed(1)} ${p1.x.toFixed(1)},${p1.y.toFixed(1)}`
  }

  // 构建闭合面积阴影路径
  const lastX = coords[coords.length - 1].x.toFixed(1)
  const firstX = coords[0].x.toFixed(1)
  const areaD = `${d} L ${lastX},${height} L ${firstX},${height} Z`

  return { lineD: d, areaD, dots: coords }
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
  generateSmoothCurve(
    (t) => (t.rejection_rate == null || t.rejection_rate < 0 ? null : (t.rejection_rate as number) * 100)
  )
)
const highRiskChart = computed(() =>
  generateSmoothCurve(
    (t) => (t.high_risk_rate == null || t.high_risk_rate < 0 ? null : (t.high_risk_rate as number) * 100)
  )
)
const approvalChart = computed(() =>
  generateSmoothCurve((t) => (t.approval_hours == null || t.approval_hours < 0 ? null : (t.approval_hours as number)))
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
    <!-- 顶部现代 Hero 态势条 -->
    <header class="dash-hero">
      <div class="hero-left">
        <div class="badge-status-chip">
          <span class="live-pulse"></span>
          <span>门禁防护体系已在线 · 实时守护中</span>
        </div>
        <h1 class="hero-headline">
          控制台概览
          <span class="sub-counter">({{ ws.changes.length }} 笔活跃工单)</span>
        </h1>
      </div>
      <div class="hero-actions">
        <button class="bento-action-btn primary" type="button" @click="openDeck">
          <TechIcon name="activity" :size="16" />
          <span>全景指挥室</span>
        </button>
        <button class="bento-action-btn secondary" type="button" @click="ws.load(true).catch(() => {})">
          <TechIcon name="refresh" :size="15" />
          <span>刷新快照</span>
        </button>
      </div>
    </header>

    <!-- Bento Grid 核心卡片栅格 (4 个功能互异的便当盒卡片) -->
    <section class="bento-metrics-grid">
      <!-- Bento 卡片 1: 待审批门禁（高优先级行动卡） -->
      <div
        class="bento-card card-action"
        :class="{ 'has-alert': pending.length > 0 }"
        @click="router.push({ name: 'approvals' })"
      >
        <div class="card-glass-glow"></div>
        <div class="card-head">
          <div class="icon-bubble wait">
            <TechIcon name="check-circle" :size="18" />
          </div>
          <span class="card-tag">AWAITING REVIEW</span>
        </div>
        <div class="card-body">
          <div class="card-metric-num">{{ pending.length }}</div>
          <div class="card-metric-title">待审批门禁单</div>
          <p class="card-metric-desc">需要同行评审与独立签署的变更</p>
        </div>
        <div class="card-foot">
          <span class="action-hint">前往审批中心 →</span>
        </div>
      </div>

      <!-- Bento 卡片 2: 检查拦截率 -->
      <div
        class="bento-card card-intercept"
        :class="{ 'has-alert': failed.length > 0 }"
        @click="router.push({ name: 'changes' })"
      >
        <div class="card-head">
          <div class="icon-bubble fail">
            <TechIcon name="shield-alert" :size="18" />
          </div>
          <span class="card-tag">CHECK FAILED</span>
        </div>
        <div class="card-body">
          <div class="card-metric-num fail">{{ failed.length }}</div>
          <div class="card-metric-title">检查未通过</div>
          <p class="card-metric-desc">规则判定不合格，已被门禁阻断</p>
        </div>
        <div class="card-foot">
          <span class="action-hint">查看阻断项 →</span>
        </div>
      </div>

      <!-- Bento 卡片 3: 高危防御池 -->
      <div
        class="bento-card card-risk"
        :class="{ 'has-alert': high.length > 0 }"
        @click="router.push({ name: 'risks' })"
      >
        <div class="card-head">
          <div class="icon-bubble warn">
            <TechIcon name="alert-triangle" :size="18" />
          </div>
          <span class="card-tag">HIGH RISK</span>
        </div>
        <div class="card-body">
          <div class="card-metric-num warn">{{ high.length }}</div>
          <div class="card-metric-title">高危待处理</div>
          <p class="card-metric-desc">需核对灰度与回滚方案的重点项</p>
        </div>
        <div class="card-foot">
          <span class="action-hint">风险矩阵 →</span>
        </div>
      </div>

      <!-- Bento 卡片 4: 消费履约进度卡 -->
      <div class="bento-card card-consumption" @click="router.push({ name: 'changes' })">
        <div class="card-head">
          <div class="icon-bubble cyan">
            <TechIcon name="code" :size="18" />
          </div>
          <span class="card-tag">PASSPORT RATIO</span>
        </div>
        <div class="card-body">
          <div class="card-metric-num brand">
            {{ consumption.percent }}<span class="metric-unit">%</span>
          </div>
          <div class="card-metric-title">通行证消费占比</div>
          <!-- 现代精细胶囊刻度进度条 -->
          <div class="progress-bar-slot">
            <div class="progress-track">
              <div class="progress-fill" :style="{ width: consumption.percent + '%' }"></div>
            </div>
          </div>
          <p class="card-metric-desc">已消费 {{ consumption.consumed }} / 已加载 {{ consumption.total }}</p>
        </div>
      </div>
    </section>

    <!-- 治理趋势深度态势中心（光晕面积折线图 + 月度柱状流） -->
    <section v-if="hasTrends" class="bento-trends-container">
      <div class="trends-top-bar">
        <div class="trends-title-block">
          <h3>变更治理趋势</h3>
          <span class="trends-period-badge">近 {{ trends.length }} 个月自然月 · UTC+8 权威口径</span>
        </div>
        <div class="trends-legend-cluster">
          <span class="legend-pill"><i class="pill-dot brand"></i>已消费</span>
          <span class="legend-pill"><i class="pill-dot red"></i>已拒绝</span>
          <span class="legend-pill"><i class="pill-dot gray"></i>推进中</span>
        </div>
      </div>

      <div class="trends-bento-subgrid">
        <!-- 柱状流: 月度提交量 -->
        <div class="chart-cell col-bars">
          <div class="chart-cell-label">月度提交量与处理流</div>
          <div class="capsule-bars-wrapper">
            <div
              v-for="b in submittedBars"
              :key="b.label"
              class="capsule-col"
              :title="`${b.label} 月：提交 ${b.total}（消费 ${b.done} / 拒绝 ${b.rejected} / 推进中 ${b.flying}）`"
            >
              <div class="capsule-stack">
                <i class="seg flying" :style="{ height: b.flyingH + '%' }"></i>
                <i class="seg rejected" :style="{ height: b.rejectedH + '%' }"></i>
                <i class="seg done" :style="{ height: b.doneH + '%' }"></i>
              </div>
              <span class="capsule-month">{{ b.label }}</span>
            </div>
          </div>
        </div>

        <!-- 曲线图 1: 拒绝率 -->
        <div class="chart-cell">
          <div class="chart-cell-label">拒绝率（定局口径）</div>
          <div class="chart-main-val">{{ rejectionValue.text }}</div>
          <div class="chart-month-badge">
            {{
              rejectionValue.month
                ? (rejectionValue.isLatest ? rejectionValue.month + ' 当月' : rejectionValue.month + ' · 上月数据')
                : '无样本'
            }}
          </div>
          <div class="spark-box">
            <svg v-if="rejectionChart" viewBox="0 0 220 56" preserveAspectRatio="none">
              <defs>
                <linearGradient id="grad-red" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="var(--cinnabar)" stop-opacity="0.25" />
                  <stop offset="100%" stop-color="var(--cinnabar)" stop-opacity="0.0" />
                </linearGradient>
              </defs>
              <path :d="rejectionChart.areaD" fill="url(#grad-red)" />
              <path :d="rejectionChart.lineD" fill="none" stroke="var(--cinnabar)" stroke-width="2.5" />
              <circle
                v-for="(p, i) in rejectionChart.dots"
                :key="i"
                :cx="p.x"
                :cy="p.y"
                r="3"
                fill="var(--surface)"
                stroke="var(--cinnabar)"
                stroke-width="2"
              />
            </svg>
            <div v-else class="spark-empty-msg">有效样本不足 3 个月</div>
          </div>
        </div>

        <!-- 曲线图 2: 高危占比 -->
        <div class="chart-cell">
          <div class="chart-cell-label">高危占比</div>
          <div class="chart-main-val warn">{{ highRiskValue.text }}</div>
          <div class="chart-month-badge">
            {{
              highRiskValue.month
                ? (highRiskValue.isLatest ? highRiskValue.month + ' 当月' : highRiskValue.month + ' · 上月数据')
                : '无样本'
            }}
          </div>
          <div class="spark-box">
            <svg v-if="highRiskChart" viewBox="0 0 220 56" preserveAspectRatio="none">
              <defs>
                <linearGradient id="grad-amber" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="var(--amber)" stop-opacity="0.25" />
                  <stop offset="100%" stop-color="var(--amber)" stop-opacity="0.0" />
                </linearGradient>
              </defs>
              <path :d="highRiskChart.areaD" fill="url(#grad-amber)" />
              <path :d="highRiskChart.lineD" fill="none" stroke="var(--amber)" stroke-width="2.5" />
              <circle
                v-for="(p, i) in highRiskChart.dots"
                :key="i"
                :cx="p.x"
                :cy="p.y"
                r="3"
                fill="var(--surface)"
                stroke="var(--amber)"
                stroke-width="2"
              />
            </svg>
            <div v-else class="spark-empty-msg">有效样本不足 3 个月</div>
          </div>
        </div>

        <!-- 曲线图 3: 平均决策时长 -->
        <div class="chart-cell">
          <div class="chart-cell-label">决策耗时 (小时)</div>
          <div class="chart-main-val brand">{{ approvalValue.text }}</div>
          <div class="chart-month-badge">
            {{
              approvalValue.month
                ? (approvalValue.isLatest ? approvalValue.month + ' 当月' : approvalValue.month + ' · 上月数据')
                : '无样本'
            }}
          </div>
          <div class="spark-box">
            <svg v-if="approvalChart" viewBox="0 0 220 56" preserveAspectRatio="none">
              <defs>
                <linearGradient id="grad-brand" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="var(--brand)" stop-opacity="0.25" />
                  <stop offset="100%" stop-color="var(--brand)" stop-opacity="0.0" />
                </linearGradient>
              </defs>
              <path :d="approvalChart.areaD" fill="url(#grad-brand)" />
              <path :d="approvalChart.lineD" fill="none" stroke="var(--brand)" stroke-width="2.5" />
              <circle
                v-for="(p, i) in approvalChart.dots"
                :key="i"
                :cx="p.x"
                :cy="p.y"
                r="3"
                fill="var(--surface)"
                stroke="var(--brand)"
                stroke-width="2"
              />
            </svg>
            <div v-else class="spark-empty-msg">有效样本不足 3 个月</div>
          </div>
        </div>
      </div>
    </section>

    <!-- 底部双列现代卡片流: 紧急待办 Feed vs 审计轨迹 -->
    <section class="bento-feed-section">
      <!-- 左列: 待处理工单流 -->
      <div class="feed-column">
        <div class="feed-head">
          <div class="feed-title">
            <TechIcon name="gauge" :size="17" />
            <span>待处理行动流</span>
            <span class="count-pill">{{ inbox.length }}</span>
          </div>
          <button class="feed-link-btn" type="button" @click="router.push({ name: 'approvals' })">
            审批中心 →
          </button>
        </div>

        <div class="feed-list-scroll">
          <div
            v-for="it in inbox"
            :key="it.c.id"
            class="feed-card-item"
            @click="open(it.c.id)"
          >
            <div class="feed-kind-indicator" :class="it.tone"></div>
            <div class="feed-card-body">
              <div class="feed-card-top">
                <span class="feed-category-tag" :class="it.tone">{{ it.kind }}</span>
                <span class="feed-time">{{ fmtTime(it.c.updated_at) }}</span>
              </div>
              <div class="feed-card-title">{{ it.c.title || it.c.summary || '未命名变更单' }}</div>
              <div class="feed-card-meta">
                <span class="service-pill">
                  <TechIcon name="server" :size="12" />
                  {{ it.c.application_name || '通用服务' }}
                </span>
                <span class="owner-name">{{ ownerOf(it.c) }}</span>
              </div>
            </div>
            <div class="feed-card-tail">
              <StatusBadge type="risk" :value="it.c.risk" size="sm" />
              <span class="arrow-indicator">↗</span>
            </div>
          </div>

          <div v-if="!inbox.length" class="feed-empty-state">
            <TechIcon name="check-circle" :size="32" />
            <h4>暂无待办事项</h4>
            <p>所有门禁检查均已处置完毕</p>
          </div>
        </div>
      </div>

      <!-- 右列: 最近工单轨迹 -->
      <div class="feed-column">
        <div class="feed-head">
          <div class="feed-title">
            <TechIcon name="scroll-text" :size="17" />
            <span>最近流转轨迹</span>
          </div>
          <button class="feed-link-btn" type="button" @click="router.push({ name: 'changes' })">
            变更列表 →
          </button>
        </div>

        <div class="feed-list-scroll">
          <div
            v-for="c in recent"
            :key="c.id"
            class="feed-card-item compact"
            @click="open(c.id)"
          >
            <div class="feed-card-body">
              <div class="feed-card-top">
                <StatusBadge type="status" :value="c.status" size="sm">
                  {{ STATUS_LABEL[c.status] || c.status }}
                </StatusBadge>
                <span class="feed-time">{{ fmtTime(c.updated_at) }}</span>
              </div>
              <div class="feed-card-title">{{ c.title || c.summary || '未命名变更单' }}</div>
              <div class="feed-card-meta">
                <span class="mono-id">{{ String(c.id).slice(0, 8) }}</span>
                <span>{{ c.application_name || '服务变更' }}</span>
              </div>
            </div>
            <div class="feed-card-tail">
              <span class="arrow-indicator">↗</span>
            </div>
          </div>

          <div v-if="!recent.length" class="feed-empty-state">
            <TechIcon name="code" :size="32" />
            <h4>暂无轨迹记录</h4>
            <p>等待第一笔变更提交进入系统</p>
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
  padding: 24px 32px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* 顶部态势横幅 */
.dash-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
}

.badge-status-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: var(--fs-12);
  color: var(--jade);
  background: var(--jade-soft);
  border: 1px solid rgba(16, 185, 129, 0.25);
  padding: 3px 10px;
  border-radius: var(--r-pill);
  font-weight: var(--fw-medium);
  margin-bottom: 6px;
}

.live-pulse {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--jade);
  box-shadow: 0 0 8px var(--jade);
  animation: pulse-glow 2s infinite ease-in-out;
}

.hero-headline {
  margin: 0;
  font-size: 26px;
  font-weight: var(--fw-bold);
  letter-spacing: -0.03em;
  color: var(--text-strong);
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.sub-counter {
  font-size: var(--fs-13);
  color: var(--text-mute);
  font-weight: var(--fw-regular);
}

.hero-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.bento-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 38px;
  padding: 0 16px;
  border-radius: var(--r-lg);
  font-size: var(--fs-13);
  font-weight: var(--fw-medium);
  transition: all var(--dur) var(--ease);
  cursor: pointer;
}

.bento-action-btn.primary {
  background: linear-gradient(135deg, var(--brand) 0%, var(--brand-bright) 100%);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow: 0 4px 14px -2px rgba(79, 70, 229, 0.4);
}
.bento-action-btn.primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px -2px rgba(79, 70, 229, 0.55);
}

.bento-action-btn.secondary {
  background: var(--surface);
  color: var(--text-strong);
  border: 1px solid var(--line);
  box-shadow: var(--shadow-card);
}
.bento-action-btn.secondary:hover {
  background: var(--bg-elev);
  transform: translateY(-1px);
}

/* Bento Grid 核心卡片栅格 */
.bento-metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 18px;
}

@media (max-width: 1080px) {
  .bento-metrics-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 640px) {
  .bento-metrics-grid { grid-template-columns: 1fr; }
}

.bento-card {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-2xl);
  padding: 22px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-shadow: var(--shadow-card);
  transition: all var(--dur) var(--ease);
  cursor: pointer;
  overflow: hidden;
  backdrop-filter: blur(12px);
}

.bento-card::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--brand), transparent);
  opacity: 0;
  transition: opacity var(--dur);
}

.bento-card:hover {
  transform: translateY(-3px);
  border-color: var(--line-strong);
  box-shadow: var(--shadow-panel), 0 12px 28px -6px rgba(15, 23, 42, 0.1);
}
.bento-card:hover::after {
  opacity: 1;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.icon-bubble {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-2);
  color: var(--text-mute);
  border: 1px solid var(--line);
}
.icon-bubble.wait { background: var(--brand-soft); color: var(--brand); border-color: rgba(79, 70, 229, 0.2); }
.icon-bubble.fail { background: var(--cinnabar-soft); color: var(--cinnabar); border-color: rgba(239, 68, 68, 0.2); }
.icon-bubble.warn { background: var(--amber-soft); color: var(--amber); border-color: rgba(245, 158, 11, 0.2); }
.icon-bubble.cyan { background: var(--cyan-soft); color: var(--cyan); border-color: rgba(6, 182, 212, 0.2); }

.card-tag {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  color: var(--text-faint);
  font-weight: var(--fw-semibold);
}

.card-metric-num {
  font-size: 36px;
  font-weight: var(--fw-bold);
  font-family: var(--font-sans);
  letter-spacing: -0.04em;
  line-height: 1;
  color: var(--text-strong);
  margin-bottom: 6px;
  font-variant-numeric: tabular-nums;
}
.card-metric-num.fail { color: var(--cinnabar); }
.card-metric-num.warn { color: var(--amber); }
.card-metric-num.brand { color: var(--brand); }
.metric-unit {
  font-size: var(--fs-18);
  font-weight: var(--fw-regular);
  margin-left: 2px;
  color: var(--text-mute);
}

.card-metric-title {
  font-size: var(--fs-14);
  font-weight: var(--fw-semibold);
  color: var(--text-strong);
  margin-bottom: 4px;
}

.card-metric-desc {
  font-size: var(--fs-12);
  color: var(--text-mute);
  line-height: var(--lh-snug);
  margin: 0;
}

.card-foot {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px dashed var(--line);
}

.action-hint {
  font-size: var(--fs-12);
  color: var(--brand);
  font-weight: var(--fw-medium);
  transition: transform var(--dur-fast);
}
.bento-card:hover .action-hint {
  display: inline-block;
  transform: translateX(4px);
}

/* 进度槽 */
.progress-bar-slot {
  margin: 10px 0 8px;
}
.progress-track {
  height: 6px;
  border-radius: var(--r-pill);
  background: var(--surface-2);
  border: 1px solid var(--line);
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  border-radius: var(--r-pill);
  background: linear-gradient(90deg, var(--cyan) 0%, var(--brand) 100%);
  transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

/* 治理趋势深度态势中心 */
.bento-trends-container {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-2xl);
  padding: 24px;
  box-shadow: var(--shadow-card);
  backdrop-filter: blur(12px);
}

.trends-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--line);
  flex-wrap: wrap;
  gap: 12px;
}

.trends-title-block {
  display: flex;
  align-items: baseline;
  gap: 12px;
}
.trends-title-block h3 {
  margin: 0;
  font-size: var(--fs-18);
  font-weight: var(--fw-bold);
  color: var(--text-strong);
  letter-spacing: -0.02em;
}
.trends-period-badge {
  font-size: var(--fs-11);
  color: var(--text-mute);
  font-family: var(--font-mono);
}

.trends-legend-cluster {
  display: flex;
  align-items: center;
  gap: 16px;
}
.legend-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-12);
  color: var(--text-mute);
}
.pill-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.pill-dot.brand { background: var(--brand); box-shadow: 0 0 6px var(--brand); }
.pill-dot.red { background: var(--cinnabar); box-shadow: 0 0 6px var(--cinnabar); }
.pill-dot.gray { background: var(--line-strong); }

.trends-bento-subgrid {
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr 1fr;
  gap: 16px;
}

@media (max-width: 1080px) {
  .trends-bento-subgrid { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 640px) {
  .trends-bento-subgrid { grid-template-columns: 1fr; }
}

.chart-cell {
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: var(--r-xl);
  padding: 16px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.chart-cell-label {
  font-size: var(--fs-12);
  color: var(--text-mute);
  font-weight: var(--fw-medium);
}
.chart-main-val {
  font-size: 26px;
  font-weight: var(--fw-bold);
  color: var(--text-strong);
  margin-top: 4px;
  letter-spacing: -0.03em;
}
.chart-main-val.warn { color: var(--amber); }
.chart-main-val.brand { color: var(--brand); }

.chart-month-badge {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--brand);
  background: var(--brand-soft);
  display: inline-block;
  align-self: flex-start;
  padding: 1px 6px;
  border-radius: var(--r-xs);
  margin-top: 2px;
  margin-bottom: 8px;
}

.spark-box {
  width: 100%;
  height: 56px;
  margin-top: 6px;
}
.spark-box svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}
.spark-empty-msg {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--fs-11);
  color: var(--text-faint);
}

.capsule-bars-wrapper {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  height: 84px;
  margin-top: 12px;
}
.capsule-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
}
.capsule-stack {
  flex: 1;
  width: 100%;
  max-width: 24px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  border-radius: 6px;
  overflow: hidden;
  background: var(--line);
}
.seg {
  width: 100%;
  transition: height 0.3s ease;
}
.seg.done { background: var(--brand); }
.seg.rejected { background: var(--cinnabar); }
.seg.flying { background: var(--line-strong); }
.capsule-month {
  margin-top: 6px;
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-faint);
}

/* 底部双列现代卡片流 */
.bento-feed-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

@media (max-width: 900px) {
  .bento-feed-section { grid-template-columns: 1fr; }
}

.feed-column {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-2xl);
  padding: 22px;
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  backdrop-filter: blur(12px);
}

.feed-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--line);
}

.feed-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--fs-16);
  font-weight: var(--fw-bold);
  color: var(--text-strong);
}

.count-pill {
  font-size: var(--fs-11);
  font-family: var(--font-mono);
  background: var(--brand-soft);
  color: var(--brand);
  padding: 1px 7px;
  border-radius: var(--r-pill);
}

.feed-link-btn {
  font-size: var(--fs-12);
  color: var(--brand);
  font-weight: var(--fw-medium);
  cursor: pointer;
  background: transparent;
  border: none;
}
.feed-link-btn:hover {
  text-decoration: underline;
}

.feed-list-scroll {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.feed-card-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: var(--r-xl);
  background: var(--surface-2);
  border: 1px solid var(--line);
  cursor: pointer;
  transition: all var(--dur-fast) var(--ease);
}
.feed-card-item:hover {
  background: var(--bg-elev);
  border-color: var(--line-strong);
  transform: translateX(3px);
}

.feed-kind-indicator {
  width: 4px;
  height: 28px;
  border-radius: 2px;
  flex-shrink: 0;
}
.feed-kind-indicator.wait { background: var(--brand); box-shadow: 0 0 8px var(--brand); }
.feed-kind-indicator.fail { background: var(--cinnabar); box-shadow: 0 0 8px var(--cinnabar); }
.feed-kind-indicator.risk { background: var(--amber); box-shadow: 0 0 8px var(--amber); }

.feed-card-body {
  flex: 1;
  min-width: 0;
}

.feed-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.feed-category-tag {
  font-size: 11px;
  font-weight: var(--fw-medium);
  padding: 1px 6px;
  border-radius: var(--r-xs);
}
.feed-category-tag.wait { color: var(--brand); background: var(--brand-soft); }
.feed-category-tag.fail { color: var(--cinnabar); background: var(--cinnabar-soft); }
.feed-category-tag.risk { color: var(--amber); background: var(--amber-soft); }

.feed-time {
  font-size: 11px;
  color: var(--text-faint);
  font-family: var(--font-mono);
}

.feed-card-title {
  font-size: var(--fs-14);
  font-weight: var(--fw-semibold);
  color: var(--text-strong);
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feed-card-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: var(--fs-12);
  color: var(--text-mute);
}

.service-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--surface);
  border: 1px solid var(--line);
  padding: 1px 6px;
  border-radius: var(--r-xs);
}

.mono-id {
  font-family: var(--font-mono);
  color: var(--text-faint);
}

.feed-card-tail {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.arrow-indicator {
  font-size: 14px;
  color: var(--text-faint);
  transition: transform var(--dur-fast), color var(--dur-fast);
}
.feed-card-item:hover .arrow-indicator {
  transform: translate(2px, -2px);
  color: var(--brand);
}

.feed-empty-state {
  text-align: center;
  padding: 40px 16px;
  color: var(--text-faint);
}
.feed-empty-state svg {
  margin: 0 auto 12px;
  opacity: 0.5;
}
.feed-empty-state h4 {
  margin: 0 0 4px;
  font-size: var(--fs-14);
  color: var(--text-mute);
}
.feed-empty-state p {
  margin: 0;
  font-size: var(--fs-12);
}
</style>
