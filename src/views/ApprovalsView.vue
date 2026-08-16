<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkspaceStore } from '@/stores/workspace'
import { api } from '@/api/client'
import TechIcon from '@/components/TechIcon.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import NeonButton from '@/components/NeonButton.vue'
import { EVIDENCE_LABEL, ownerOf, fmtTime } from '@/lib/labels'

const ws = useWorkspaceStore()
const router = useRouter()
const busy = ref<Record<string, boolean>>({})
const rows = computed(() => ws.changes.filter(c => c.status === 'WAITING_APPROVAL'))

async function act(id: string, action: 'approve' | 'reject') {
  busy.value[id + action] = true
  try { await api.changeAction(id, action); await ws.load(true) }
  catch (e: any) { alert(e?.message || '操作失败') }
  finally { busy.value[id + action] = false }
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <div class="page-kicker mono">APPROVALS</div>
        <div class="page-title">审批中心</div>
        <div class="page-sub">等待独立判断 · {{ rows.length }} 单待处理</div>
      </div>
      <div class="page-actions"><NeonButton size="sm" @click="ws.load(true)"><TechIcon name="refresh" :size="15" /> 刷新</NeonButton></div>
    </div>

    <div v-if="!rows.length" class="empty-full">当前没有待审批变更</div>
    <div v-else class="ap-list">
      <article v-for="row in rows" :key="row.id" class="ap-card">
        <header>
          <span class="id-cell">{{ String(row.id).slice(0, 8) }}</span>
          <StatusBadge type="risk" :value="row.risk" size="sm" />
        </header>
        <h3 @click="router.push({ name: 'change-detail', params: { id: row.id } })">{{ row.title || row.summary || '未命名变更' }}</h3>
        <p>{{ row.application_name || '未归属服务' }} · {{ ownerOf(row) }} · {{ fmtTime(row.updated_at) }}</p>
        <div class="ap-meta">
          <span>证据 {{ EVIDENCE_LABEL[row.evidence_state || 'NOT_RUN'] || row.evidence_state || '未验证' }}</span>
          <span>{{ (row.findings || []).length }} 项规则命中</span>
        </div>
        <footer>
          <NeonButton variant="ghost" size="sm" @click="router.push({ name: 'change-detail', params: { id: row.id } })">打开通行证</NeonButton>
          <NeonButton size="sm" :loading="busy[row.id + 'approve']" @click="act(row.id, 'approve')"><TechIcon name="check-circle" :size="14" /> 批准</NeonButton>
          <NeonButton variant="danger" size="sm" :loading="busy[row.id + 'reject']" @click="act(row.id, 'reject')"><TechIcon name="x-circle" :size="14" /> 拒绝</NeonButton>
        </footer>
      </article>
    </div>
  </div>
</template>

<style scoped>
@import './page.css';
.ap-list { display: grid; gap: 0.95rem; }
.ap-card {
  padding: 1.2rem 1.35rem 1.15rem; border-radius: var(--r-lg);
  background: var(--surface); border: 1px solid var(--line);
  border-top: 2px solid var(--gold);
}
.ap-card header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.55rem; }
.ap-card h3 { margin: 0; font-size: 1.28rem; color: var(--text-strong); cursor: pointer; font-weight: 500; font-family: var(--font-display); }
.ap-card h3:hover { color: var(--gold-bright); }
.ap-card p { margin: 0.45rem 0 0.85rem; font-size: 0.9rem; color: var(--text-mute); }
.ap-meta { display: flex; gap: 1rem; font-size: 0.76rem; color: var(--text-faint); margin-bottom: 0.95rem; }
.ap-card footer { display: flex; gap: 0.5rem; flex-wrap: wrap; }
</style>
