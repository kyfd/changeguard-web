<script setup lang="ts">
import { computed } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import StatusBadge from '@/components/StatusBadge.vue'

const ws = useWorkspaceStore()
const counts = computed(() => {
  const m = new Map<string, number>()
  ws.changes.forEach(c => {
    const k = c.application_id || c.application_name || ''
    if (k) m.set(k, (m.get(k) || 0) + 1)
  })
  return m
})

function appStatus(a: any) {
  const s = String(a.status || 'active').toLowerCase()
  if (s === 'inactive' || s === 'disabled' || s === 'stopped') return { value: 'PENDING', label: '已停用' }
  return { value: 'OK', label: '运行中' }
}

function changeCount(a: any) {
  return counts.value.get(a.id) || counts.value.get(a.name) || counts.value.get(a.code) || 0
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <div class="page-title">服务</div>
        <div class="page-sub">应用列表 · {{ ws.apps.length }} 个服务</div>
      </div>
    </div>

    <div v-if="!ws.apps.length" class="empty-full">暂无服务</div>
    <div v-else class="ledger">
      <div class="ledger-head" aria-hidden="true">
        <span>服务</span>
        <span>说明</span>
        <span>状态</span>
        <span>变更</span>
      </div>
      <article v-for="a in ws.apps" :key="a.id" class="row">
        <h3>{{ a.name || a.code || '未命名服务' }}</h3>
        <p>{{ a.description || a.code || a.id || '暂无说明' }}</p>
        <StatusBadge type="status" :value="appStatus(a).value" size="sm">{{ appStatus(a).label }}</StatusBadge>
        <span class="count"><b>{{ changeCount(a) }}</b> 单</span>
      </article>
    </div>
  </div>
</template>

<style scoped>
@import './page.css';

.ledger {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  background: var(--surface);
  box-shadow: var(--shadow-card);
}
:root[data-theme="light"] .ledger { box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6), var(--shadow-card); }
.ledger-head,
.row {
  display: grid;
  grid-template-columns: minmax(136px, 0.85fr) minmax(0, 1.6fr) 88px 68px;
  gap: var(--sp-4);
  align-items: center;
  padding: var(--sp-3) var(--sp-4);
}
.ledger-head {
  font-family: var(--font-mono);
  font-size: var(--fs-11);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-faint);
  border-bottom: 1px solid var(--line);
  position: sticky;
  top: 0;
  background: var(--surface);
  z-index: 1;
  padding-top: var(--sp-2);
  padding-bottom: var(--sp-2);
}
.row {
  border-top: 1px solid var(--line);
  min-width: 0;
}
.row:first-of-type { border-top: none; }
.row:hover { background: var(--bg-elev); }
.row h3 {
  margin: 0;
  font-size: var(--fs-13);
  font-weight: var(--fw-medium);
  color: var(--text-strong);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.row p {
  margin: 0;
  font-size: var(--fs-12);
  color: var(--text-mute);
  line-height: var(--lh-snug);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-width: 0;
}
.count {
  font-size: var(--fs-11);
  color: var(--text-mute);
  text-align: right;
  white-space: nowrap;
}
.count b {
  font-family: var(--font-sans);
  font-size: var(--fs-14);
  font-weight: var(--fw-semibold);
  color: var(--brand);
  margin-right: 2px;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 820px) {
  .ledger-head { display: none; }
  .row {
    grid-template-columns: 1fr auto;
    grid-template-areas:
      "name status"
      "desc desc"
      "count count";
    gap: var(--sp-1) var(--sp-3);
  }
  .row h3 { grid-area: name; }
  .row p { grid-area: desc; -webkit-line-clamp: 3; }
  .row :deep(.badge) { grid-area: status; justify-self: end; }
  .count { grid-area: count; text-align: left; }
}
</style>
