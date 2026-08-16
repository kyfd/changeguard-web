<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkspaceStore } from '@/stores/workspace'
import TechIcon from '@/components/TechIcon.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import TechTable from '@/components/TechTable.vue'
import NeonButton from '@/components/NeonButton.vue'
import { STATUS_LABEL, ownerOf, fmtTime } from '@/lib/labels'

const ws = useWorkspaceStore()
const router = useRouter()
const q = ref('')
const statusFilter = ref('')
const statusOpts = Object.entries(STATUS_LABEL).map(([k, v]) => ({ k, v }))

const rows = computed(() => {
  const query = q.value.trim().toLowerCase()
  return ws.changes.filter(c => {
    const searchable = [c.id, c.title, c.summary, c.application_name, c.application_id, ownerOf(c)]
      .filter(Boolean).join(' ').toLowerCase()
    const okQ = !query || searchable.includes(query)
    const okS = !statusFilter.value || c.status === statusFilter.value
    return okQ && okS
  }).sort((a, b) => safeTime(b.updated_at || b.created_at) - safeTime(a.updated_at || a.created_at))
})
const columns = [
  { key: 'id', label: 'ID', width: '120px', mono: true },
  { key: 'title', label: '标题' },
  { key: 'app', label: '应用', width: '130px' },
  { key: 'owner', label: '负责人', width: '110px' },
  { key: 'risk', label: '风险', width: '90px', align: 'center' as const },
  { key: 'status', label: '状态', width: '110px', align: 'center' as const },
  { key: 'updated', label: '更新时间', width: '160px', mono: true },
]

function safeTime(value?: string) {
  const time = value ? new Date(value).getTime() : 0
  return Number.isFinite(time) ? time : 0
}
async function refresh() {
  try { await ws.load(true) } catch {}
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <div class="page-kicker mono">CHANGES</div>
        <div class="page-title">变更工单</div>
        <div class="page-sub">全部变更单 · {{ ws.changes.length }} 条 · 当前显示 {{ rows.length }}</div>
      </div>
      <div class="page-actions"><NeonButton size="sm" :loading="ws.loading" @click="refresh"><TechIcon name="refresh" :size="15" /> 刷新</NeonButton></div>
    </div>

    <div v-if="ws.error" class="load-error" role="alert">
      <div><strong>变更工单加载失败</strong><span>{{ ws.error }}</span></div>
      <NeonButton variant="ghost" size="sm" :loading="ws.loading" @click="refresh">重试</NeonButton>
    </div>

    <div class="toolbar">
      <label class="search-box"><TechIcon name="search" :size="15" /><input v-model="q" placeholder="搜索 ID / 标题 / 应用 / 负责人" /></label>
      <select v-model="statusFilter"><option value="">全部状态</option><option v-for="s in statusOpts" :key="s.k" :value="s.k">{{ s.v }}</option></select>
    </div>

    <TechTable :columns="columns" :rows="rows" :row-key="(r: any) => r.id" empty="没有匹配的变更" :click="(row: any) => router.push({ name: 'change-detail', params: { id: row.id } })">
      <template #cell-id="{ row }"><span class="id-cell">{{ String(row.id).slice(0, 8) }}</span></template>
      <template #cell-title="{ row }"><span class="ellipsis">{{ row.title || row.summary || '未命名变更' }}</span></template>
      <template #cell-app="{ row }"><span class="muted">{{ row.application_name || row.application_id || '—' }}</span></template>
      <template #cell-owner="{ row }">{{ ownerOf(row) }}</template>
      <template #cell-risk="{ row }"><StatusBadge type="risk" :value="row.risk" size="sm" /></template>
      <template #cell-status="{ row }"><StatusBadge type="status" :value="row.status" size="sm">{{ STATUS_LABEL[row.status] || row.status }}</StatusBadge></template>
      <template #cell-updated="{ row }">{{ fmtTime(row.updated_at) }}</template>
    </TechTable>
  </div>
</template>

<style scoped>
@import './page.css';
.load-error { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: .75rem .9rem; margin-bottom: .75rem; border: 1px solid rgba(255,90,112,.35); border-radius: var(--r); background: var(--red-soft); }
.load-error > div { display: grid; gap: .18rem; }
.load-error strong { color: var(--red-bright); font-size: .86rem; }
.load-error span { color: var(--text-mute); font-size: .78rem; }
@media (max-width: 720px) {
  .load-error { align-items: flex-start; }
  .toolbar { align-items: stretch; }
  .toolbar select { width: 100%; }
}
</style>
