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
  padding: 1.15rem 1.25rem; border-radius: var(--r-lg);
  background: var(--surface); border: 1px solid var(--line);
}
.stat span { display: block; font-size: 0.78rem; color: var(--text-faint); }
.stat strong { display: block; margin-top: 0.4rem; font-size: 2.2rem; color: var(--gold-bright); font-weight: 500; font-family: var(--font-display); }
.stat.hi strong { color: var(--cinnabar); }
.risk-list { display: grid; gap: 0.5rem; }
.risk-row {
  display: grid; grid-template-columns: auto 1fr auto; gap: 0.8rem; align-items: center;
  padding: 0.88rem 1.05rem; border-radius: var(--r); background: var(--surface);
  border: 1px solid var(--line); text-align: left; color: inherit;
}
.risk-row:hover { border-color: var(--line-bright); }
.risk-main strong { display: block; font-size: 0.88rem; color: var(--text-strong); }
.risk-main small { display: block; margin-top: 0.18rem; font-size: 0.72rem; color: var(--text-faint); }
</style>
