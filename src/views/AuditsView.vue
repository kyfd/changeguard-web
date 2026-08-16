<script setup lang="ts">
import { ref, computed } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import TechIcon from '@/components/TechIcon.vue'
import TechTable from '@/components/TechTable.vue'

const ws = useWorkspaceStore()
const q = ref('')
const rows = computed(() => (ws.audits || []).filter((a: any) => !q.value || JSON.stringify(a).toLowerCase().includes(q.value.toLowerCase())).slice(0, 250))
const columns = [
  { key: 'at', label: '时间', width: '170px', mono: true },
  { key: 'actor', label: '操作人', width: '130px' },
  { key: 'action', label: '动作', width: '140px' },
  { key: 'target', label: '对象' },
]
function time(t?: string) { return t ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'medium', hour12: false }).format(new Date(t)) : '—' }
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <div class="page-kicker mono">AUDIT</div>
        <div class="page-title">审计日志</div>
        <div class="page-sub">完整操作追踪 · {{ ws.audits?.length || 0 }} 条记录</div>
      </div>
    </div>

    <div class="toolbar">
      <label class="search-box"><TechIcon name="search" :size="15" /><input v-model="q" placeholder="搜索操作人 / 动作 / 对象" /></label>
    </div>

    <TechTable :columns="columns" :rows="rows" :row-key="(r: any, i: number) => (r.id || '') + i" empty="暂无审计记录">
      <template #cell-at="{ row }">{{ time(row.at || row.created_at || row.time) }}</template>
      <template #cell-actor="{ row }"><span class="muted">{{ row.actor || row.actor_name || row.user || '系统' }}</span></template>
      <template #cell-action="{ row }"><span class="id-cell">{{ row.action || row.event || '—' }}</span></template>
      <template #cell-target="{ row }"><span class="ellipsis">{{ row.target || row.target_id || row.resource || JSON.stringify(row).slice(0, 60) }}</span></template>
    </TechTable>
  </div>
</template>

<style scoped>@import './page.css';</style>
