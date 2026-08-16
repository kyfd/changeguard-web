<script setup lang="ts">
import { ref } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { api } from '@/api/client'
import TechIcon from '@/components/TechIcon.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import NeonButton from '@/components/NeonButton.vue'

const ws = useWorkspaceStore()
const busy = ref<Record<string, boolean>>({})

const sevLabel: Record<string, string> = { HIGH: '高危', MEDIUM: '中危', LOW: '低危' }

async function toggle(id: string) {
  busy.value[id] = true
  try { await api.togglePolicy(id); await ws.load(true) }
  catch (e: any) { alert(e?.message || '操作失败') }
  finally { busy.value[id] = false }
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <div class="page-title">治理规则</div>
        <div class="page-sub">策略库 · {{ ws.policies.length }} 条 · {{ ws.policies.filter((p: any) => p.enabled !== false).length }} 启用</div>
      </div>
      <div class="page-actions"><NeonButton size="sm" @click="ws.load(true)"><TechIcon name="refresh" :size="15" /> 刷新</NeonButton></div>
    </div>

    <div v-if="!ws.policies.length" class="empty-full">暂无治理规则</div>
    <div v-else class="ledger">
      <div class="ledger-head" aria-hidden="true">
        <span>规则</span>
        <span>说明</span>
        <span>等级</span>
        <span>状态</span>
        <span></span>
      </div>
      <article v-for="p in ws.policies" :key="p.id" class="row" :class="{ off: p.enabled === false }">
        <div class="name">
          <h3>{{ p.title || p.name || '未命名规则' }}</h3>
          <small class="id-cell">{{ String(p.id).slice(0, 10) }}</small>
        </div>
        <p>{{ p.description || p.pattern || '暂无说明' }}</p>
        <span class="sev" :class="'sv-' + String(p.severity || '').toLowerCase()">{{ sevLabel[String(p.severity || '').toUpperCase()] || p.severity || '—' }}</span>
        <StatusBadge type="status" :value="p.enabled !== false ? 'OK' : 'PENDING'" size="sm">{{ p.enabled !== false ? '启用' : '停用' }}</StatusBadge>
        <NeonButton :variant="p.enabled !== false ? 'subtle' : 'primary'" size="sm" :loading="busy[p.id]" @click="toggle(p.id)">
          {{ p.enabled !== false ? '停用' : '启用' }}
        </NeonButton>
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
}
.ledger-head,
.row {
  display: grid;
  grid-template-columns: minmax(9rem, 0.9fr) minmax(0, 1.5fr) 4.2rem 4.6rem auto;
  gap: 1rem;
  align-items: center;
  padding: 0.95rem 1.25rem;
}
.ledger-head {
  font-size: 0.74rem;
  color: var(--text-faint);
  border-bottom: 1px solid var(--line);
  position: sticky;
  top: 0;
  background: var(--surface);
  z-index: 1;
}
.row { border-top: 1px solid var(--line); min-width: 0; }
.row:first-of-type { border-top: none; }
.row:hover { background: var(--gold-soft); }
.row.off { opacity: 0.55; }
.name { min-width: 0; }
.name h3 {
  margin: 0;
  font-size: 1.02rem;
  font-weight: 500;
  color: var(--text-strong);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.name small { display: block; margin-top: 0.2rem; }
.row p {
  margin: 0;
  font-size: 0.84rem;
  color: var(--text-mute);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-width: 0;
}
.sev {
  font-size: 0.8rem;
  white-space: nowrap;
}
.sv-high { color: var(--cinnabar); }
.sv-medium { color: var(--amber); }
.sv-low { color: var(--jade); }

@media (max-width: 900px) {
  .ledger-head { display: none; }
  .row {
    grid-template-columns: 1fr auto;
    gap: 0.4rem 0.8rem;
  }
  .row p { grid-column: 1 / -1; }
}
</style>
