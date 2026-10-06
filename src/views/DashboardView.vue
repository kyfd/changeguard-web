<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkspaceStore } from '@/stores/workspace.ts'
import { api } from '@/api/client.ts'
import TechIcon from '@/components/TechIcon.vue'
import StatusBadge from '@/components/StatusBadge.vue'
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

/* 平滑三次贝塞尔光晕面积图 */
function generateSmoothCurve(getter: (t: any) => number | null, width = 240, height = 64) {
  const values = trends.value.map((t) => getter(t))
  const pts = values
    .map((v, i) => (v == null ? null : { x: i, y: v, v }))
    .filter(Boolean) as { x: number; y: number; v: number }[]
  if (pts.length < 3) return null

  const lo = Math.min(...pts.map((p) => p.v))
  const hi = Math.max(...pts.map((p) => p.v))
  const span = hi - lo || 1
  const pad = 8
  const usableH = height - pad * 2
  const step = width / (trends.value.length - 1 || 1)

  const coords = pts.map((p) => ({
    x: p.x * step,
    y: pad + ((hi - p.v) / span) * usableH,
    v: p.v,
  }))

  let d = `M ${coords[0].x.toFixed(1)},${coords[0].y.toFixed(1)}`
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i]
    const p1 = coords[i + 1]
    const mx = (p0.x + p1.x) / 2
    d += ` C ${mx.toFixed(1)},${p0.y.toFixed(1)} ${mx.toFixed(1)},${p1.y.toFixed(1)} ${p1.x.toFixed(1)},${p1.y.toFixed(1)}`
  }

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
    <!-- Awwwards 级先锋 Hero 标题区 -->
    <header class="dash-hero">
      <div class="hero-left">
        <div class="status-orb-pill">
          <span class="pulsing-dot"></span>
          <span>AUTONOMOUS CONTROL ENGINE · ACTIVE</span>
        </div>
        <h1 class="hero-title text-metallic">
          变更防御驾驶舱
          <span class="sub-counter">{{ ws.changes.length }} 笔在册变更</span>
        </h1>
        <p class="hero-sub">实时拦截未经签发的线上变更，确保系统确定性与零故障履约</p>
      </div>

      <div class="hero-actions">
        <button class="action-cyber-btn primary" type="button" @click="openDeck">
          <TechIcon name="activity" :size="16" />
          <span>全景指挥室</span>
        </button>
        <button class="action-cyber-btn ghost" type="button" @click="ws.load(true).catch(() => {})">
          <TechIcon name="refresh" :size="15" />
          <span>刷新态势</span>
        </button>
      </div>
    </header>

    <!-- Bento Grid 便当盒交错栅格 -->
    <section class="bento-grid">
      <!-- Bento 1: 待审批门禁单 (重点行动卡) -->
      <div
        class="bento-card bento-hero-action"
        :class="{ active: pending.length > 0 }"
        @click="router.push({ name: 'approvals' })"
      >
        <div class="bento-orb-glow purple"></div>
        <div class="bento-header">
          <span class="bento-kicker">INTAKE · 01</span>
          <span class="bento-badge">CRITICAL</span>
        </div>
        <div class="bento-body">
          <div class="bento-hero-num">{{ pending.length }}</div>
          <div class="bento-title">待审批门禁单</div>
          <p class="bento-desc">阻断拦截生效中，等待合规签名</p>
        </div>
        <div class="bento-footer">
          <span class="link-label">审批决策中心 →</span>
        </div>
      </div>

      <!-- Bento 2: 阻断与检查失败 -->
      <div
        class="bento-card"
        :class="{ danger: failed.length > 0 }"
        @click="router.push({ name: 'changes' })"
      >
        <div class="bento-orb-glow red"></div>
        <div class="bento-header">
          <span class="bento-kicker">INTERCEPT · 02</span>
        </div>
        <div class="bento-body">
          <div class="bento-hero-num err">{{ failed.length }}</div>
          <div class="bento-title">静态检查阻断</div>
          <p class="bento-desc">规则不符或未经验证的变更已被拦截</p>
        </div>
        <div class="bento-footer">
          <span class="link-label">查看拦截证据 →</span>
        </div>
      </div>

      <!-- Bento 3: 高危态势池 -->
      <div
        class="bento-card"
        :class="{ warn: high.length > 0 }"
        @click="router.push({ name: 'risks' })"
      >
        <div class="bento-orb-glow amber"></div>
        <div class="bento-header">
          <span class="bento-kicker">EXPOSURE · 03</span>
        </div>
        <div class="bento-body">
          <div class="bento-hero-num warn">{{ high.length }}</div>
          <div class="bento-title">高危待处置</div>
          <p class="bento-desc">涉及锁表或全表风险的敏感操作</p>
        </div>
        <div class="bento-footer">
          <span class="link-label">风险矩阵看板 →</span>
        </div>
      </div>

      <!-- Bento 4: 通行证消费履约率 -->
      <div class="bento-card bento-ratio-card" @click="router.push({ name: 'changes' })">
        <div class="bento-orb-glow cyan"></div>
        <div class="bento-header">
          <span class="bento-kicker">PASSPORT · 04</span>
          <span class="bento-badge-cyan">{{ consumption.consumed }}/{{ consumption.total }} 笔</span>
        </div>
        <div class="bento-body">
          <div class="bento-hero-num cyan">
            {{ consumption.percent }}<span class="unit">%</span>
          </div>
          <div class="bento-title">通行证消费履约率</div>

          <!-- 双轨渐变微光进度条 -->
          <div class="glow-track-slot">
            <div class="glow-track">
              <div class="glow-fill" :style="{ width: consumption.percent + '%' }"></div>
            </div>
          </div>
          <p class="bento-desc">生产流水线已验证并成功兑现的比例</p>
        </div>
      </div>
    </section>

    <!-- 治理态势深度分析 (SVG 贝塞尔面积发光图) -->
    <section v-if="hasTrends" class="bento-trends-board">
      <div class="trends-top-bar">
        <div class="trends-title-col">
          <h2>变更防御态势时序</h2>
          <span class="trends-subtitle">近 {{ trends.length }} 个自然月趋势矩阵 · UTC+8 审计采样</span>
        </div>
        <div class="trends-tag-cluster">
          <span class="tag-dot brand"><i></i>已消费</span>
          <span class="tag-dot red"><i></i>已拒绝</span>
          <span class="tag-dot gray"><i></i>推进中</span>
        </div>
      </div>

      <div class="trends-sub-grid">
        <!-- 柱状流: 月度提交量 -->
        <div class="trend-box-bars">
          <div class="trend-box-header">月度提交流与处置栈</div>
          <div class="bar-chart-container">
            <div
              v-for="b in submittedBars"
              :key="b.label"
              class="bar-track-col"
              :title="`${b.label} 月：提交 ${b.total}（消费 ${b.done} / 拒绝 ${b.rejected} / 推进中 ${b.flying}）`"
            >
              <div class="bar-capsule">
                <i class="seg-fill flying" :style="{ height: b.flyingH + '%' }"></i>
                <i class="seg-fill rejected" :style="{ height: b.rejectedH + '%' }"></i>
                <i class="seg-fill done" :style="{ height: b.doneH + '%' }"></i>
              </div>
              <span class="bar-month-text">{{ b.label }}</span>
            </div>
          </div>
        </div>

        <!-- 贝塞尔折线图 1: 拒绝率 -->
        <div class="trend-box">
          <div class="trend-box-header">定局拒绝率</div>
          <div class="trend-val-row">
            <span class="trend-big-val">{{ rejectionValue.text }}</span>
            <span class="trend-month-pill">{{ rejectionValue.month ? rejectionValue.month + ' 月' : '无数据' }}</span>
          </div>
          <div class="svg-spark-wrapper">
            <svg v-if="rejectionChart" viewBox="0 0 240 64" preserveAspectRatio="none">
              <defs>
                <linearGradient id="glow-grad-red" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#fb7185" stop-opacity="0.35" />
                  <stop offset="100%" stop-color="#fb7185" stop-opacity="0.0" />
                </linearGradient>
              </defs>
              <path :d="rejectionChart.areaD" fill="url(#glow-grad-red)" />
              <path :d="rejectionChart.lineD" fill="none" stroke="#fb7185" stroke-width="2.5" />
              <circle
                v-for="(p, i) in rejectionChart.dots"
                :key="i"
                :cx="p.x"
                :cy="p.y"
                r="3.5"
                fill="#030712"
                stroke="#fb7185"
                stroke-width="2"
              />
            </svg>
            <div v-else class="spark-no-sample">连续样本不足 3 个月</div>
          </div>
        </div>

        <!-- 贝塞尔折线图 2: 高危占比 -->
        <div class="trend-box">
          <div class="trend-box-header">高危变更占比</div>
          <div class="trend-val-row">
            <span class="trend-big-val warn">{{ highRiskValue.text }}</span>
            <span class="trend-month-pill">{{ highRiskValue.month ? highRiskValue.month + ' 月' : '无数据' }}</span>
          </div>
          <div class="svg-spark-wrapper">
            <svg v-if="highRiskChart" viewBox="0 0 240 64" preserveAspectRatio="none">
              <defs>
                <linearGradient id="glow-grad-amber" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.35" />
                  <stop offset="100%" stop-color="#fbbf24" stop-opacity="0.0" />
                </linearGradient>
              </defs>
              <path :d="highRiskChart.areaD" fill="url(#glow-grad-amber)" />
              <path :d="highRiskChart.lineD" fill="none" stroke="#fbbf24" stroke-width="2.5" />
              <circle
                v-for="(p, i) in highRiskChart.dots"
                :key="i"
                :cx="p.x"
                :cy="p.y"
                r="3.5"
                fill="#030712"
                stroke="#fbbf24"
                stroke-width="2"
              />
            </svg>
            <div v-else class="spark-no-sample">连续样本不足 3 个月</div>
          </div>
        </div>

        <!-- 贝塞尔折线图 3: 平均决策耗时 -->
        <div class="trend-box">
          <div class="trend-box-header">平均签署决策耗时</div>
          <div class="trend-val-row">
            <span class="trend-big-val cyan">{{ approvalValue.text }}<small>h</small></span>
            <span class="trend-month-pill">{{ approvalValue.month ? approvalValue.month + ' 月' : '无数据' }}</span>
          </div>
          <div class="svg-spark-wrapper">
            <svg v-if="approvalChart" viewBox="0 0 240 64" preserveAspectRatio="none">
              <defs>
                <linearGradient id="glow-grad-cyan" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.35" />
                  <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.0" />
                </linearGradient>
              </defs>
              <path :d="approvalChart.areaD" fill="url(#glow-grad-cyan)" />
              <path :d="approvalChart.lineD" fill="none" stroke="#38bdf8" stroke-width="2.5" />
              <circle
                v-for="(p, i) in approvalChart.dots"
                :key="i"
                :cx="p.x"
                :cy="p.y"
                r="3.5"
                fill="#030712"
                stroke="#38bdf8"
                stroke-width="2"
              />
            </svg>
            <div v-else class="spark-no-sample">连续样本不足 3 个月</div>
          </div>
        </div>
      </div>
    </section>

    <!-- 底部双列先锋卡片流 -->
    <section class="feed-grid">
      <!-- 待处理工单流 -->
      <div class="feed-card-panel">
        <div class="feed-panel-head">
          <div class="feed-title-wrap">
            <span class="dot-radar"></span>
            <h3>待处置行动流</h3>
            <span class="feed-counter">{{ inbox.length }}</span>
          </div>
          <button class="feed-ghost-link" type="button" @click="router.push({ name: 'approvals' })">
            审批中心 ↗
          </button>
        </div>

        <div class="feed-scroll-flow">
          <div
            v-for="it in inbox"
            :key="it.c.id"
            class="feed-card"
            @click="open(it.c.id)"
          >
            <div class="feed-indicator-edge" :class="it.tone"></div>
            <div class="feed-content">
              <div class="feed-meta-row">
                <span class="feed-pill" :class="it.tone">{{ it.kind }}</span>
                <span class="feed-timestamp">{{ fmtTime(it.c.updated_at) }}</span>
              </div>
              <div class="feed-item-title">{{ it.c.title || it.c.summary || '未命名变更单' }}</div>
              <div class="feed-extra-row">
                <span class="app-chip">
                  <TechIcon name="server" :size="12" />
                  {{ it.c.application_name || '主应用' }}
                </span>
                <span class="owner-tag">负责人: {{ ownerOf(it.c) }}</span>
              </div>
            </div>
            <div class="feed-right-action">
              <StatusBadge type="risk" :value="it.c.risk" size="sm" />
              <span class="arrow-glyph">→</span>
            </div>
          </div>

          <div v-if="!inbox.length" class="feed-empty-box">
            <TechIcon name="check-circle" :size="36" />
            <h4>所有门禁防线运行良好</h4>
            <p>当前没有需要人工干预的待办项</p>
          </div>
        </div>
      </div>

      <!-- 最近流转轨迹 -->
      <div class="feed-card-panel">
        <div class="feed-panel-head">
          <div class="feed-title-wrap">
            <h3>近期流转轨迹</h3>
          </div>
          <button class="feed-ghost-link" type="button" @click="router.push({ name: 'changes' })">
            变更记录 ↗
          </button>
        </div>

        <div class="feed-scroll-flow">
          <div
            v-for="c in recent"
            :key="c.id"
            class="feed-card"
            @click="open(c.id)"
          >
            <div class="feed-content">
              <div class="feed-meta-row">
                <StatusBadge type="status" :value="c.status" size="sm">
                  {{ STATUS_LABEL[c.status] || c.status }}
                </StatusBadge>
                <span class="feed-timestamp">{{ fmtTime(c.updated_at) }}</span>
              </div>
              <div class="feed-item-title">{{ c.title || c.summary || '未命名变更单' }}</div>
              <div class="feed-extra-row">
                <span class="mono-hash">{{ String(c.id).slice(0, 8) }}</span>
                <span>{{ c.application_name || '服务变更' }}</span>
              </div>
            </div>
            <div class="feed-right-action">
              <span class="arrow-glyph">→</span>
            </div>
          </div>

          <div v-if="!recent.length" class="feed-empty-box">
            <TechIcon name="code" :size="36" />
            <h4>暂无流转历史</h4>
            <p>等待第一张变更工单进入安全网关</p>
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
  padding: 36px 44px 48px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 32px;
  box-sizing: border-box;
}

@media (max-width: 880px) {
  .dashboard-viewport {
    padding: 24px 20px 32px;
    gap: 24px;
  }
}

/* 顶部 Hero 先锋排版 */
.dash-hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
}

.status-orb-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.16em;
  color: var(--jade-bright);
  background: rgba(52, 211, 153, 0.12);
  border: 1px solid rgba(52, 211, 153, 0.3);
  padding: 3px 12px;
  border-radius: var(--r-pill);
  font-weight: 600;
  box-shadow: 0 0 20px rgba(52, 211, 153, 0.2);
  margin-bottom: 8px;
}

.pulsing-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--jade-bright);
  box-shadow: 0 0 10px var(--jade-bright);
  animation: pulse-glow 2s infinite ease-in-out;
}

.hero-title {
  font-size: 36px;
  letter-spacing: -0.04em;
  font-weight: 800;
  line-height: 1.1;
  margin: 0;
  display: flex;
  align-items: baseline;
  gap: 14px;
}

.sub-counter {
  font-size: 14px;
  font-weight: 400;
  color: var(--text-faint);
  font-family: var(--font-mono);
  letter-spacing: 0;
}

.hero-sub {
  margin-top: 6px;
  font-size: 14px;
  color: var(--text-mute);
  max-width: 600px;
}

.hero-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.action-cyber-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 42px;
  padding: 0 20px;
  border-radius: var(--r-lg);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
  cursor: pointer;
  transition: all var(--dur) var(--ease);
}

.action-cyber-btn.primary {
  background: linear-gradient(135deg, #4f46e5 0%, #6366f1 50%, #38bdf8 100%);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.4),
    0 8px 25px rgba(79, 70, 229, 0.5);
}
.action-cyber-btn.primary:hover {
  transform: translateY(-2px);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.5),
    0 12px 35px rgba(79, 70, 229, 0.7);
}

.action-cyber-btn.ghost {
  background: var(--surface);
  color: var(--text-strong);
  border: 1px solid var(--line);
  backdrop-filter: blur(16px);
  box-shadow: var(--shadow-card);
}
.action-cyber-btn.ghost:hover {
  background: var(--surface-2);
  border-color: var(--line-strong);
  transform: translateY(-2px);
}

/* Bento Grid */
.bento-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}
@media (max-width: 1100px) {
  .bento-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 640px) {
  .bento-grid { grid-template-columns: 1fr; }
}

.bento-card {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-2xl);
  padding: 26px 24px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-shadow: var(--shadow-panel);
  transition: all var(--dur) var(--ease);
  cursor: pointer;
  overflow: hidden;
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
}

/* Awwwards 顶缘微晶发光线 */
.bento-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
}

/* 弥散发光光斑 */
.bento-orb-glow {
  position: absolute;
  width: 140px;
  height: 140px;
  border-radius: 50%;
  top: -40px;
  right: -40px;
  filter: blur(60px);
  opacity: 0.25;
  pointer-events: none;
  transition: opacity 0.3s;
}
.bento-orb-glow.purple { background: #818cf8; }
.bento-orb-glow.red { background: #fb7185; }
.bento-orb-glow.amber { background: #fbbf24; }
.bento-orb-glow.cyan { background: #38bdf8; }

.bento-card:hover {
  transform: translateY(-4px);
  border-color: rgba(255, 255, 255, 0.25);
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.2);
}
.bento-card:hover .bento-orb-glow {
  opacity: 0.45;
}

.bento-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}

.bento-kicker {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.16em;
  color: var(--text-faint);
  font-weight: 600;
}

.bento-badge {
  font-size: 10px;
  font-family: var(--font-mono);
  padding: 2px 8px;
  border-radius: var(--r-pill);
  background: rgba(251, 113, 133, 0.15);
  color: var(--cinnabar);
  border: 1px solid rgba(251, 113, 133, 0.3);
  font-weight: 600;
}
.bento-badge-cyan {
  font-size: 11px;
  font-family: var(--font-mono);
  padding: 2px 8px;
  border-radius: var(--r-pill);
  background: rgba(56, 189, 248, 0.12);
  color: var(--cyan-bright);
  border: 1px solid rgba(56, 189, 248, 0.25);
}

.bento-hero-num {
  font-size: 46px;
  font-weight: 800;
  letter-spacing: -0.05em;
  line-height: 1;
  color: #ffffff;
  font-variant-numeric: tabular-nums;
  margin-bottom: 8px;
  text-shadow: 0 0 25px rgba(255, 255, 255, 0.2);
}
.bento-hero-num.err { color: #fb7185; text-shadow: 0 0 30px rgba(251, 113, 133, 0.35); }
.bento-hero-num.warn { color: #fbbf24; text-shadow: 0 0 30px rgba(251, 191, 36, 0.35); }
.bento-hero-num.cyan { color: #38bdf8; text-shadow: 0 0 30px rgba(56, 189, 248, 0.35); }
.bento-hero-num .unit { font-size: 20px; font-weight: 400; color: var(--text-mute); }

.bento-title {
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  letter-spacing: -0.02em;
  margin-bottom: 4px;
}

.bento-desc {
  font-size: 12px;
  color: var(--text-mute);
  line-height: 1.5;
  margin: 0;
}

.bento-footer {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px dashed var(--line);
}

.link-label {
  font-size: 12px;
  color: var(--brand-bright);
  font-weight: 600;
  transition: all var(--dur-fast);
}
.bento-card:hover .link-label {
  color: #fff;
  text-shadow: 0 0 10px var(--brand);
}

/* 进度刻度槽 */
.glow-track-slot {
  margin: 12px 0 10px;
}
.glow-track {
  height: 6px;
  border-radius: var(--r-pill);
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}
.glow-fill {
  height: 100%;
  border-radius: var(--r-pill);
  background: linear-gradient(90deg, #38bdf8 0%, #818cf8 100%);
  box-shadow: 0 0 12px #38bdf8;
  transition: width 0.6s var(--ease);
}

/* 治理态势深度分析 */
.bento-trends-board {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-2xl);
  padding: 28px;
  box-shadow: var(--shadow-panel);
  backdrop-filter: blur(24px);
}

.trends-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--line);
  flex-wrap: wrap;
  gap: 14px;
}

.trends-title-col h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
  color: #fff;
  letter-spacing: -0.02em;
}
.trends-subtitle {
  font-size: 12px;
  color: var(--text-faint);
  font-family: var(--font-mono);
}

.trends-tag-cluster {
  display: flex;
  align-items: center;
  gap: 16px;
}
.tag-dot {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-mute);
}
.tag-dot i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.tag-dot.brand i { background: #818cf8; box-shadow: 0 0 8px #818cf8; }
.tag-dot.red i { background: #fb7185; box-shadow: 0 0 8px #fb7185; }
.tag-dot.gray i { background: var(--line-strong); }

.trends-sub-grid {
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr 1fr;
  gap: 18px;
}
@media (max-width: 1100px) {
  .trends-sub-grid { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 640px) {
  .trends-sub-grid { grid-template-columns: 1fr; }
}

.trend-box, .trend-box-bars {
  background: rgba(11, 17, 32, 0.55);
  border: 1px solid var(--line);
  border-radius: var(--r-xl);
  padding: 18px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.trend-box-header {
  font-size: 12px;
  color: var(--text-mute);
  font-weight: 600;
  letter-spacing: 0.02em;
}

.trend-val-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-top: 6px;
  margin-bottom: 8px;
}

.trend-big-val {
  font-size: 28px;
  font-weight: 800;
  color: #fff;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}
.trend-big-val.warn { color: #fbbf24; }
.trend-big-val.cyan { color: #38bdf8; }
.trend-big-val small { font-size: 14px; font-weight: 400; color: var(--text-mute); }

.trend-month-pill {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--brand-bright);
  background: var(--brand-soft);
  padding: 2px 7px;
  border-radius: var(--r-xs);
}

.svg-spark-wrapper {
  width: 100%;
  height: 64px;
}
.svg-spark-wrapper svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}
.spark-no-sample {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--text-faint);
}

.bar-chart-container {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  height: 94px;
  margin-top: 12px;
}
.bar-track-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
}
.bar-capsule {
  flex: 1;
  width: 100%;
  max-width: 26px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  border-radius: 8px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.06);
}
.seg-fill {
  width: 100%;
  transition: height 0.3s ease;
}
.seg-fill.done { background: #818cf8; }
.seg-fill.rejected { background: #fb7185; }
.seg-fill.flying { background: rgba(255, 255, 255, 0.2); }
.bar-month-text {
  margin-top: 8px;
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-faint);
}

/* 底部双列先锋卡片流 */
.feed-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}
@media (max-width: 960px) {
  .feed-grid { grid-template-columns: 1fr; }
}

.feed-card-panel {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-2xl);
  padding: 26px;
  box-shadow: var(--shadow-panel);
  display: flex;
  flex-direction: column;
  backdrop-filter: blur(24px);
}

.feed-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--line);
}

.feed-title-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}
.feed-title-wrap h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 800;
  color: #fff;
  letter-spacing: -0.02em;
}

.dot-radar {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--brand-bright);
  box-shadow: 0 0 10px var(--brand-bright);
}

.feed-counter {
  font-size: 11px;
  font-family: var(--font-mono);
  background: var(--brand-soft);
  color: var(--brand-bright);
  padding: 2px 8px;
  border-radius: var(--r-pill);
  font-weight: 700;
}

.feed-ghost-link {
  font-size: 13px;
  color: var(--brand-bright);
  font-weight: 600;
  cursor: pointer;
  background: transparent;
  border: none;
  transition: all var(--dur-fast);
}
.feed-ghost-link:hover {
  color: #fff;
  text-shadow: 0 0 10px var(--brand);
}

.feed-scroll-flow {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.feed-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 18px;
  border-radius: var(--r-xl);
  background: rgba(11, 17, 32, 0.6);
  border: 1px solid var(--line);
  cursor: pointer;
  transition: all var(--dur-fast) var(--ease);
}
.feed-card:hover {
  background: rgba(30, 41, 59, 0.7);
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateX(4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

.feed-indicator-edge {
  width: 4px;
  height: 32px;
  border-radius: 2px;
  flex-shrink: 0;
}
.feed-indicator-edge.wait { background: #818cf8; box-shadow: 0 0 10px #818cf8; }
.feed-indicator-edge.fail { background: #fb7185; box-shadow: 0 0 10px #fb7185; }
.feed-indicator-edge.risk { background: #fbbf24; box-shadow: 0 0 10px #fbbf24; }

.feed-content {
  flex: 1;
  min-width: 0;
}

.feed-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 5px;
}

.feed-pill {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: var(--r-xs);
}
.feed-pill.wait { color: #818cf8; background: rgba(99, 102, 241, 0.15); }
.feed-pill.fail { color: #fb7185; background: rgba(251, 113, 133, 0.15); }
.feed-pill.risk { color: #fbbf24; background: rgba(251, 191, 36, 0.15); }

.feed-timestamp {
  font-size: 11px;
  color: var(--text-faint);
  font-family: var(--font-mono);
}

.feed-item-title {
  font-size: 14.5px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feed-extra-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: var(--text-mute);
}

.app-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--line);
  padding: 1px 7px;
  border-radius: var(--r-xs);
}

.mono-hash {
  font-family: var(--font-mono);
  color: var(--text-faint);
}

.arrow-glyph {
  font-size: 16px;
  color: var(--text-faint);
  transition: all var(--dur-fast);
}
.feed-card:hover .arrow-glyph {
  color: #fff;
  transform: translateX(3px);
}

.feed-empty-box {
  text-align: center;
  padding: 50px 20px;
  color: var(--text-faint);
}
.feed-empty-box svg {
  margin: 0 auto 12px;
  opacity: 0.4;
}
.feed-empty-box h4 {
  margin: 0 0 4px;
  font-size: 15px;
  color: var(--text-mute);
}
</style>
