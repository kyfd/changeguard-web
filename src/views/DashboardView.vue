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
    .slice(0, 8)
)
const consumption = computed(() => consumptionStats(ws.changes))

/* 待办按紧急度合并：待审批优先，其次检查失败，再次高危待处理 */
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
    out.push({ c, kind: '检查失败', tone: 'fail' })
  }
  for (const c of high.value) {
    if (seen.has(c.id)) continue
    seen.add(c.id)
    out.push({ c, kind: '高危待处理', tone: 'risk' })
  }
  return out
})

const headline = computed(() => {
  const bits: string[] = []
  if (pending.value.length) bits.push(`${pending.value.length} 单待审批`)
  if (failed.value.length) bits.push(`${failed.value.length} 单检查未通过`)
  if (high.value.length) bits.push(`${high.value.length} 条高危待处理`)
  if (!ws.changes.length) return '工作空间已就绪，等待第一张变更单'
  return bits.length ? bits.join(' · ') : '当前已加载变更没有上述待办'
})

function open(id: string) {
  router.push({ name: 'change-detail', params: { id } })
}

function openDeck() {
  router.push({ name: 'panorama' })
}

/* 变更趋势：近 6 个自然月（UTC+8 口径） */
const trends = ref<any[]>([])
const trendsLoaded = ref(false)

onMounted(async () => {
  try {
    const data = await api.trends(6)
    trends.value = Array.isArray(data) ? data : []
  } catch {
    /* 趋势是增强信息，加载失败不打扰工作台 */
  }
  trendsLoaded.value = true
})

const hasTrends = computed(() => trendsLoaded.value && trends.value.some((t: any) => (t.submitted || 0) > 0))

function seriesPoints(getter: (t: any) => number | null, width: number, height: number) {
  const values = trends.value.map((t) => getter(t))
  const valid = values.filter((v): v is number => v != null)
  if (valid.length === 0) return null
  const max = Math.max(...valid, 0.0001)
  const step = trends.value.length > 1 ? width / (trends.value.length - 1) : 0
  const pts = values
    .map((v, i) => {
      if (v == null) return null
      const x = trends.value.length > 1 ? i * step : width / 2
      const y = height - (v / max) * (height - 6) - 3
      return { x, y, v }
    })
    .filter(Boolean) as { x: number; y: number; v: number }[]
  if (pts.length < 1) return null
  return {
    line: pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
    dots: pts,
  }
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

const rejectionSeries = computed(() =>
  seriesPoints(
    (t) => (t.rejection_rate == null || t.rejection_rate < 0 ? null : (t.rejection_rate as number) * 100),
    100,
    40
  )
)
const highRiskSeries = computed(() =>
  seriesPoints(
    (t) => (t.high_risk_rate == null || t.high_risk_rate < 0 ? null : (t.high_risk_rate as number) * 100),
    100,
    40
  )
)
const approvalSeries = computed(() =>
  seriesPoints(
    (t) => (t.approval_hours == null || t.approval_hours < 0 ? null : (t.approval_hours as number)),
    100,
    40
  )
)

function lastValue(getter: (t: any) => number | null, unit = '') {
  for (let i = trends.value.length - 1; i >= 0; i--) {
    const v = getter(trends.value[i])
    if (v != null && v >= 0) {
      return unit === '%' ? `${Math.round(v * 100)}%` : `${Math.round(v * 10) / 10}${unit}`
    }
  }
  return '—'
}
</script>

<template>
  <div class="page">
    <!-- 头部区域 -->
    <div class="page-head">
      <div>
        <div class="page-kicker mono">NOW</div>
        <div class="page-title">工作台</div>
        <div class="page-sub">{{ headline }}</div>
      </div>
      <div class="page-actions">
        <NeonButton variant="ghost" size="sm" @click="openDeck">
          <TechIcon name="activity" :size="15" /> 全景总览
        </NeonButton>
        <NeonButton size="sm" @click="ws.load(true).catch(() => {})">
          <TechIcon name="refresh" :size="15" /> 刷新
        </NeonButton>
      </div>
    </div>

    <!-- 顶部 4 格 KPI 核心卡片 -->
    <div class="now-grid">
      <button
        class="now-card"
        :class="{ mute: !pending.length }"
        @click="router.push({ name: 'approvals' })"
      >
        <span>待审批</span>
        <strong>{{ pending.length }}</strong>
        <small>需要独立判断的变更</small>
      </button>

      <button
        class="now-card warn"
        :class="{ mute: !failed.length }"
        @click="router.push({ name: 'changes' })"
      >
        <span>检查未通过</span>
        <strong>{{ failed.length }}</strong>
        <small>门禁拦下，需整改后重提</small>
      </button>

      <button
        class="now-card warn"
        :class="{ mute: !high.length }"
        @click="router.push({ name: 'risks' })"
      >
        <span>高危待处理</span>
        <strong>{{ high.length }}</strong>
        <small>请核对规则结果与验证证据</small>
      </button>

      <button class="now-card" @click="router.push({ name: 'changes' })">
        <span>消费占比</span>
        <strong>{{ consumption.percent }}<em>%</em></strong>
        <small>通行证已消费 {{ consumption.consumed }} / 已加载 {{ consumption.total }}</small>
      </button>
    </div>

    <!-- 治理趋势：仅在有历史数据时出现 -->
    <section v-if="hasTrends" class="trends">
      <header>
        <h3>变更趋势<span class="hint mono">近 {{ trends.length }} 个月 · UTC+8 月口径</span></h3>
        <span class="legend">
          <i class="dot brand"></i>通行证已消费 <i class="dot red"></i>已拒绝 <i class="dot gray"></i>推进中
        </span>
      </header>
      <div class="trend-grid">
        <div class="trend">
          <div class="kicker">月提交量</div>
          <div class="bars">
            <div
              v-for="b in submittedBars"
              :key="b.label"
              class="bar-col"
              :title="`${b.label} 月：提交 ${b.total}（消费 ${b.done} / 拒绝 ${b.rejected} / 推进中 ${b.flying}）`"
            >
              <div class="bar-stack">
                <i class="seg flying" :style="{ height: b.flyingH + '%' }"></i>
                <i class="seg rejected" :style="{ height: b.rejectedH + '%' }"></i>
                <i class="seg done" :style="{ height: b.doneH + '%' }"></i>
              </div>
              <small class="mono">{{ b.label }}</small>
            </div>
          </div>
        </div>

        <div class="trend">
          <div class="kicker">拒绝率（定局口径）</div>
          <strong class="now mono">{{
            lastValue((t) => (t.rejection_rate < 0 ? null : t.rejection_rate), '%')
          }}</strong>
          <svg viewBox="0 0 100 40" preserveAspectRatio="none" class="spark">
            <polyline
              v-if="rejectionSeries"
              :points="rejectionSeries.line"
              fill="none"
              stroke="var(--cinnabar)"
              stroke-width="1.8"
            />
            <circle
              v-for="(p, i) in rejectionSeries?.dots || []"
              :key="i"
              :cx="p.x"
              :cy="p.y"
              r="2"
              fill="var(--cinnabar)"
            />
          </svg>
        </div>

        <div class="trend">
          <div class="kicker">高危占比</div>
          <strong class="now mono">{{
            lastValue((t) => (t.high_risk_rate < 0 ? null : t.high_risk_rate), '%')
          }}</strong>
          <svg viewBox="0 0 100 40" preserveAspectRatio="none" class="spark">
            <polyline
              v-if="highRiskSeries"
              :points="highRiskSeries.line"
              fill="none"
              stroke="var(--amber)"
              stroke-width="1.8"
            />
            <circle
              v-for="(p, i) in highRiskSeries?.dots || []"
              :key="i"
              :cx="p.x"
              :cy="p.y"
              r="2"
              fill="var(--amber)"
            />
          </svg>
        </div>

        <div class="trend">
          <div class="kicker">平均决策时长（小时）</div>
          <strong class="now mono">{{
            lastValue((t) => (t.approval_hours < 0 ? null : t.approval_hours))
          }}</strong>
          <svg viewBox="0 0 100 40" preserveAspectRatio="none" class="spark">
            <polyline
              v-if="approvalSeries"
              :points="approvalSeries.line"
              fill="none"
              stroke="var(--brand)"
              stroke-width="1.8"
            />
            <circle
              v-for="(p, i) in approvalSeries?.dots || []"
              :key="i"
              :cx="p.x"
              :cy="p.y"
              r="2"
              fill="var(--brand)"
            />
          </svg>
        </div>
      </div>
    </section>

    <!-- 底部双列队列：待处理事项 vs 最近轨迹 -->
    <div class="split">
      <section class="queue">
        <header>
          <h3>待处理事项<span class="count mono">{{ inbox.length }}</span></h3>
          <button class="text-link" @click="router.push({ name: 'approvals' })">全部审批</button>
        </header>
        <button
          v-for="it in inbox"
          :key="it.c.id"
          class="queue-row"
          @click="open(it.c.id)"
        >
          <span class="tag" :class="it.tone">{{ it.kind }}</span>
          <div class="row-main">
            <strong class="ellipsis">{{ it.c.title || it.c.summary || '未命名变更' }}</strong>
            <small>{{ it.c.application_name || '未归属服务' }} · {{ ownerOf(it.c) }} · {{ fmtTime(it.c.updated_at) }}</small>
          </div>
          <StatusBadge type="risk" :value="it.c.risk" size="sm" />
        </button>
        <div v-if="!inbox.length" class="empty-full">没有需要立即处理的事项</div>
      </section>

      <section class="queue">
        <header>
          <h3>最近轨迹</h3>
          <button class="text-link" @click="router.push({ name: 'changes' })">全部变更</button>
        </header>
        <button
          v-for="c in recent"
          :key="c.id"
          class="queue-row compact"
          @click="open(c.id)"
        >
          <StatusBadge type="status" :value="c.status" size="sm">
            {{ STATUS_LABEL[c.status] || c.status }}
          </StatusBadge>
          <div class="row-main">
            <strong class="ellipsis">{{ c.title || c.summary || '未命名变更' }}</strong>
            <small class="mono">{{ String(c.id).slice(0, 8) }} · {{ fmtTime(c.updated_at) }}</small>
          </div>
        </button>
        <div v-if="!recent.length" class="empty-full">还没有变更记录</div>
      </section>
    </div>
  </div>
</template>

<style scoped>
@import './page.css';

.now-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--sp-4);
  margin-bottom: var(--sp-4);
  flex: none;
}

@media (max-width: 860px) {
  .now-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.now-card {
  text-align: left;
  padding: var(--sp-4) var(--sp-5);
  border-radius: var(--r-xl);
  background: var(--surface);
  border: 1px solid var(--line);
  color: inherit;
  box-shadow: var(--shadow-card);
  transition: transform var(--dur-fast), border-color var(--dur-fast), box-shadow var(--dur-fast);
  cursor: pointer;
}

.now-card:hover {
  transform: translateY(-2px);
  border-color: var(--brand);
  box-shadow: var(--shadow-panel);
}

.now-card span {
  display: block;
  font-family: var(--font-mono);
  font-size: var(--fs-11);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-faint);
  margin-bottom: 8px;
}

.now-card strong {
  display: block;
  font-size: var(--fs-24);
  color: var(--brand);
  font-weight: var(--fw-semibold);
  font-family: var(--font-sans);
  line-height: var(--lh-tight);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}

.now-card strong em {
  font-style: normal;
  font-size: var(--fs-13);
  margin-left: 2px;
  color: var(--text-mute);
}

.now-card small {
  display: block;
  margin-top: 6px;
  color: var(--text-faint);
  font-size: var(--fs-12);
  line-height: var(--lh-snug);
}

.now-card.warn strong {
  color: var(--cinnabar);
}

.now-card.mute strong {
  color: var(--text-faint);
}

/* 治理趋势面板 */
.trends {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-xl);
  padding: var(--sp-4) var(--sp-5);
  margin-bottom: var(--sp-4);
  box-shadow: var(--shadow-card);
}

.trends header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--sp-3);
}

.trends h3 {
  margin: 0;
  font-size: var(--fs-14);
  font-weight: var(--fw-semibold);
  color: var(--text-strong);
}

.hint {
  font-size: var(--fs-11);
  color: var(--text-faint);
  margin-left: var(--sp-2);
  font-weight: normal;
}

.legend {
  font-size: var(--fs-11);
  color: var(--text-mute);
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}

.legend .dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 4px;
}

.legend .dot.brand {
  background: var(--brand);
}
.legend .dot.red {
  background: var(--cinnabar);
}
.legend .dot.gray {
  background: var(--line-strong);
}

.trend-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--sp-4);
}

@media (max-width: 860px) {
  .trend-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.trend {
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: var(--r);
  padding: var(--sp-3);
}

.trend .kicker {
  font-size: var(--fs-11);
  color: var(--text-mute);
  margin-bottom: 6px;
}

.trend .now {
  display: block;
  font-size: var(--fs-20);
  font-weight: var(--fw-semibold);
  color: var(--text-strong);
  margin-bottom: 8px;
}

.bars {
  display: flex;
  align-items: flex-end;
  height: 60px;
  gap: 6px;
  padding-top: 10px;
}

.bar-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
}

.bar-stack {
  flex: 1;
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  border-radius: 2px;
  overflow: hidden;
  background: var(--line);
}

.seg {
  width: 100%;
  transition: height var(--dur);
}
.seg.done {
  background: var(--brand);
}
.seg.rejected {
  background: var(--cinnabar);
}
.seg.flying {
  background: var(--text-faint);
}

.bar-col small {
  margin-top: 4px;
  font-size: 10px;
  color: var(--text-faint);
}

.spark {
  width: 100%;
  height: 38px;
  overflow: visible;
}

/* 队列分栏 */
.split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sp-4);
}

@media (max-width: 860px) {
  .split {
    grid-template-columns: 1fr;
  }
}

.queue {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-xl);
  padding: var(--sp-4) var(--sp-5);
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
}

.queue header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--sp-3);
  padding-bottom: var(--sp-2);
  border-bottom: 1px solid var(--line);
}

.queue h3 {
  margin: 0;
  font-size: var(--fs-14);
  font-weight: var(--fw-semibold);
  color: var(--text-strong);
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}

.count {
  font-size: var(--fs-12);
  background: var(--brand-soft);
  color: var(--brand);
  padding: 1px 6px;
  border-radius: var(--r-pill);
}

.text-link {
  background: transparent;
  border: none;
  font-size: var(--fs-12);
  color: var(--brand);
  cursor: pointer;
}

.text-link:hover {
  text-decoration: underline;
}

.queue-row {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-2);
  border-radius: var(--r);
  border: none;
  background: transparent;
  width: 100%;
  text-align: left;
  cursor: pointer;
  transition: background var(--dur-fast);
  border-bottom: 1px solid var(--line);
}

.queue-row:last-child {
  border-bottom: none;
}

.queue-row:hover {
  background: var(--bg-elev);
}

.row-main {
  flex: 1;
  min-width: 0;
}

.row-main strong {
  display: block;
  font-size: var(--fs-13);
  color: var(--text-strong);
}

.row-main small {
  font-size: var(--fs-11);
  color: var(--text-faint);
}

.ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag {
  font-size: var(--fs-11);
  padding: 2px 6px;
  border-radius: var(--r-xs);
  white-space: nowrap;
}
.tag.wait {
  background: var(--amber-soft);
  color: var(--amber);
}
.tag.fail {
  background: var(--cinnabar-soft);
  color: var(--cinnabar);
}
.tag.risk {
  background: var(--cinnabar-soft);
  color: var(--cinnabar);
}

.empty-full {
  padding: var(--sp-8) 0;
  text-align: center;
  color: var(--text-faint);
  font-size: var(--fs-13);
}
</style>
