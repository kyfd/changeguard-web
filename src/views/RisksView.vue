<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkspaceStore } from '@/stores/workspace'
import TechIcon from '@/components/TechIcon.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import NeonButton from '@/components/NeonButton.vue'

const ws = useWorkspaceStore()
const router = useRouter()
const findings = computed(() => ws.changes.flatMap(c => (c.findings || []).map((f: any) => ({ ...f, changeId: c.id, changeTitle: c.title || c.summary }))))
const high = computed(() => findings.value.filter((f: any) => f.severity === 'HIGH'))
const med = computed(() => findings.value.filter((f: any) => f.severity === 'MEDIUM'))
const rest = computed(() => findings.value.filter((f: any) => f.severity !== 'HIGH' && f.severity !== 'MEDIUM'))

function open(id: string) { router.push({ name: 'change-detail', params: { id } }) }
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
        <NeonButton variant="ghost" size="sm" @click="router.push({ name: 'policies' })"><TechIcon name="shield" :size="15" /> 规则</NeonButton>
      </div>
    </div>

    <div class="kpi-row">
      <div class="stat"><span>发现总数</span><strong class="mono">{{ findings.length }}</strong></div>
      <div class="stat hi"><span>高危</span><strong class="mono">{{ high.length }}</strong></div>
      <div class="stat"><span>中危</span><strong class="mono">{{ med.length }}</strong></div>
      <div class="stat"><span>启用规则</span><strong class="mono">{{ ws.policies.filter((p: any) => p.enabled !== false).length }}</strong></div>
    </div>

    <div v-if="!findings.length" class="empty-full">暂无风险发现</div>
    <div v-else class="risk-list">
      <button v-for="(f, i) in findings" :key="(f.changeId || '') + (f.code || '') + i" class="risk-row" @click="open(f.changeId)">
        <StatusBadge type="risk" :value="f.severity" size="sm" />
        <div class="risk-main">
          <strong>{{ f.title || f.changeTitle }}</strong>
          <small><span class="mono">{{ f.code || '—' }}</span> · {{ String(f.changeId).slice(0, 8) }}</small>
        </div>
        <TechIcon name="chevron-right" :size="16" />
      </button>
    </div>
  </div>
</template>

<style scoped>
@import './page.css';
.stat {
  padding: var(--sp-4); border-radius: var(--r-lg);
  background: var(--surface); border: 1px solid var(--line);
  box-shadow: var(--shadow-card);
}
:root[data-theme="light"] .stat { box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6), var(--shadow-card); }
.stat span {
  display: block;
  font-family: var(--font-mono); font-size: var(--fs-11);
  letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--text-faint); margin-bottom: 8px;
}
/* 与工作台 KPI 同一档：同一个系统里同类指标不该有两种字号 */
.stat strong {
  display: block; font-size: var(--fs-24);
  color: var(--brand); font-weight: var(--fw-semibold);
  font-family: var(--font-sans); font-variant-numeric: tabular-nums;
  line-height: var(--lh-tight); letter-spacing: -0.01em;
}
.stat.hi strong { color: var(--cinnabar); }
/* 列表用连续行而非带间隙的卡片：扫读时行与行要能直接比对 */
.risk-list {
  display: flex; flex-direction: column;
  background: var(--surface); border: 1px solid var(--line);
  border-radius: var(--r-lg); box-shadow: var(--shadow-card);
  overflow: auto;
}
:root[data-theme="light"] .risk-list { box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6), var(--shadow-card); }
.risk-row {
  display: grid; grid-template-columns: auto 1fr auto; gap: var(--sp-3); align-items: center;
  min-height: 48px; padding: var(--sp-2) var(--sp-4);
  border-top: 1px solid var(--line); text-align: left; color: inherit;
  transition: background var(--dur-fast);
}
.risk-row:first-of-type { border-top: none; }
.risk-row:hover { background: var(--bg-elev); }
.risk-main strong { display: block; font-size: var(--fs-13); color: var(--text-strong); font-weight: var(--fw-medium); }
.risk-main small { display: block; margin-top: 1px; font-size: var(--fs-11); color: var(--text-faint); }
</style>
