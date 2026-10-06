<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkspaceStore } from '@/stores/workspace.ts'
import TechIcon from '@/components/TechIcon.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import NeonButton from '@/components/NeonButton.vue'

const ws = useWorkspaceStore()
const router = useRouter()

const findings = computed(() =>
  ws.changes.flatMap((c) =>
    (c.findings || []).map((f: any) => ({
      ...f,
      changeId: c.id,
      changeTitle: c.title || c.summary,
    }))
  )
)
const high = computed(() => findings.value.filter((f: any) => f.severity === 'HIGH'))
const med = computed(() => findings.value.filter((f: any) => f.severity === 'MEDIUM'))
const rest = computed(() => findings.value.filter((f: any) => f.severity !== 'HIGH' && f.severity !== 'MEDIUM'))

function open(id: string) {
  router.push({ name: 'change-detail', params: { id } })
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <div class="page-kicker mono">RISKS</div>
        <div class="page-title">风险中心</div>
        <div class="page-sub">规则命中发现 · {{ findings.length }} 项 · {{ high.length }} 条高危</div>
      </div>
      <div class="page-actions">
        <NeonButton variant="ghost" size="sm" @click="router.push({ name: 'policies' })">
          <TechIcon name="shield" :size="15" /> 规则列表
        </NeonButton>
      </div>
    </div>

    <!-- 风险核心指标卡 -->
    <div class="kpi-row">
      <div class="stat-card">
        <span class="stat-label">发现总数</span>
        <strong class="stat-num mono">{{ findings.length }}</strong>
      </div>
      <div class="stat-card is-high">
        <span class="stat-label">高危风险</span>
        <strong class="stat-num mono err">{{ high.length }}</strong>
      </div>
      <div class="stat-card is-warn">
        <span class="stat-label">中危风险</span>
        <strong class="stat-num mono warn">{{ med.length }}</strong>
      </div>
      <div class="stat-card">
        <span class="stat-label">生效规则</span>
        <strong class="stat-num mono">{{ ws.policies.filter((p: any) => p.enabled !== false).length }}</strong>
      </div>
    </div>

    <div v-if="!findings.length" class="empty-full">
      <TechIcon name="check-circle" :size="32" />
      <h4>暂无风险发现项</h4>
      <p>当前所有规则检查均通过，未命中任何阻断</p>
    </div>

    <!-- 风险发现流 -->
    <div v-else class="risk-list-panel">
      <div class="panel-header">
        <span>命中风险明细流</span>
        <span class="count-badge mono">{{ findings.length }} 条</span>
      </div>
      <div class="risk-rows-container">
        <button
          v-for="(f, i) in findings"
          :key="(f.changeId || '') + (f.code || '') + i"
          class="risk-row-card"
          type="button"
          @click="open(f.changeId)"
        >
          <StatusBadge type="risk" :value="f.severity" size="sm" />
          <div class="risk-main">
            <strong class="risk-title">{{ f.title || f.changeTitle || '未命名风险' }}</strong>
            <small class="risk-meta">
              <span class="mono-code">{{ f.code || '—' }}</span> · 工单
              <span class="mono-id">{{ String(f.changeId).slice(0, 8) }}</span>
            </small>
          </div>
          <span class="arrow-icon" aria-hidden="true">↗</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import './page.css';

.stat-card {
  padding: 20px 22px;
  border-radius: var(--r-xl);
  background: var(--surface);
  border: 1px solid var(--line);
  box-shadow: var(--shadow-card);
  transition: all var(--dur-fast);
  backdrop-filter: blur(8px);
}
.stat-card:hover {
  transform: translateY(-2px);
  border-color: var(--line-strong);
}

.stat-label {
  display: block;
  font-family: var(--font-mono);
  font-size: var(--fs-11);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-faint);
  margin-bottom: 6px;
  font-weight: var(--fw-medium);
}

.stat-num {
  display: block;
  font-size: 28px;
  color: var(--brand);
  font-weight: var(--fw-bold);
  font-family: var(--font-sans);
  line-height: 1;
  letter-spacing: -0.03em;
}
.stat-num.err { color: var(--cinnabar); }
.stat-num.warn { color: var(--amber); }

.risk-list-panel {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-2xl);
  box-shadow: var(--shadow-card);
  overflow: hidden;
  backdrop-filter: blur(12px);
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--line);
  font-size: var(--fs-13);
  font-weight: var(--fw-semibold);
  color: var(--text-strong);
  background: var(--surface-2);
}

.count-badge {
  font-size: 11px;
  color: var(--brand);
  background: var(--brand-soft);
  padding: 1px 7px;
  border-radius: var(--r-pill);
}

.risk-rows-container {
  display: flex;
  flex-direction: column;
}

.risk-row-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--line);
  text-align: left;
  background: transparent;
  color: inherit;
  transition: all var(--dur-fast);
  cursor: pointer;
  width: 100%;
}
.risk-row-card:last-child {
  border-bottom: none;
}
.risk-row-card:hover {
  background: var(--bg-elev);
}

.risk-main {
  flex: 1;
  min-width: 0;
}

.risk-title {
  display: block;
  font-size: var(--fs-14);
  color: var(--text-strong);
  font-weight: var(--fw-medium);
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.risk-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-12);
  color: var(--text-mute);
}

.mono-code {
  font-family: var(--font-mono);
  color: var(--text-strong);
  background: var(--surface-2);
  padding: 1px 5px;
  border-radius: var(--r-xs);
  border: 1px solid var(--line);
}

.mono-id {
  font-family: var(--font-mono);
  color: var(--text-faint);
}

.arrow-icon {
  font-size: 14px;
  color: var(--text-faint);
  transition: transform var(--dur-fast), color var(--dur-fast);
}
.risk-row-card:hover .arrow-icon {
  transform: translate(2px, -2px);
  color: var(--brand);
}
</style>
