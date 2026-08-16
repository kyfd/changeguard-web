<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkspaceStore } from '@/stores/workspace'
import TechIcon from '@/components/TechIcon.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import NeonButton from '@/components/NeonButton.vue'
import { STATUS_LABEL, ownerOf, fmtTime } from '@/lib/labels'

const ws = useWorkspaceStore()
const router = useRouter()

const pending = computed(() => ws.changes.filter(c => c.status === 'WAITING_APPROVAL'))
const high = computed(() => ws.changes.filter(c => c.risk === 'HIGH' && !['APPROVED', 'COMPLETED', 'REJECTED'].includes(c.status)))
const recent = computed(() => [...ws.changes].sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || '')).slice(0, 6))
const closed = computed(() => ws.changes.filter(c => ['APPROVED', 'COMPLETED'].includes(c.status)).length)
const closure = computed(() => ws.changes.length ? Math.round(closed.value / ws.changes.length * 100) : 0)

const next = computed(() => pending.value[0] || high.value[0] || recent.value[0] || null)
const headline = computed(() => {
  if (pending.value.length) return `有 ${pending.value.length} 单待独立审批`
  if (high.value.length) return `有 ${high.value.length} 条高危变更未闭环`
  if (!ws.changes.length) return '工作空间已就绪，等待第一张变更单'
  return '当前没有阻塞项，治理节奏平稳'
})

function open(id: string) { router.push({ name: 'change-detail', params: { id } }) }
function openDeck() {
  router.push({ name: 'panorama' })
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <div class="page-kicker mono">NOW</div>
        <div class="page-title">工作台</div>
        <div class="page-sub">{{ headline }}</div>
      </div>
      <div class="page-actions">
        <NeonButton variant="ghost" size="sm" @click="openDeck"><TechIcon name="activity" :size="15" /> 全景</NeonButton>
        <NeonButton size="sm" @click="ws.load(true)"><TechIcon name="refresh" :size="15" /> 刷新</NeonButton>
      </div>
    </div>

    <div class="now-grid">
      <button class="now-card" @click="router.push({ name: 'approvals' })">
        <span>待审批</span>
        <strong>{{ pending.length }}</strong>
        <small>需要独立判断的变更</small>
      </button>
      <button class="now-card warn" @click="router.push({ name: 'risks' })">
        <span>未闭环高危</span>
        <strong>{{ high.length }}</strong>
        <small>整改完成前不可批准</small>
      </button>
      <button class="now-card" @click="router.push({ name: 'changes' })">
        <span>闭环率</span>
        <strong>{{ closure }}<em>%</em></strong>
        <small>已闭环 {{ closed }} / {{ ws.changes.length }}</small>
      </button>
    </div>
    <article v-if="next" class="now-next" @click="open(next.id)">
      <div>
        <span>建议下一步</span>
        <h3>{{ next.title || next.summary || '未命名变更' }}</h3>
        <p>{{ next.application_name || '未归属服务' }} · {{ STATUS_LABEL[next.status] || next.status }}</p>
      </div>
      <NeonButton variant="ghost" size="sm">打开</NeonButton>
    </article>

    <div class="split">
      <section class="queue">
        <header>
          <h3>待你处理</h3>
          <button class="text-link" @click="router.push({ name: 'approvals' })">全部审批</button>
        </header>
        <button v-for="c in pending.slice(0, 5)" :key="c.id" class="queue-row" @click="open(c.id)">
          <StatusBadge type="risk" :value="c.risk" size="sm" />
          <div>
            <strong>{{ c.title || c.summary || '未命名变更' }}</strong>
            <small>{{ ownerOf(c) }} · {{ fmtTime(c.updated_at) }}</small>
          </div>
        </button>
        <button v-for="c in high.filter(x => x.status !== 'WAITING_APPROVAL').slice(0, 3)" :key="'h'+c.id" class="queue-row" @click="open(c.id)">
          <StatusBadge type="status" value="CRITICAL" size="sm">高危</StatusBadge>
          <div>
            <strong>{{ c.title || c.summary || '未命名变更' }}</strong>
            <small>{{ STATUS_LABEL[c.status] || c.status }}</small>
          </div>
        </button>
        <div v-if="!pending.length && !high.length" class="empty-full">没有需要立即处理的事项</div>
      </section>

      <section class="queue">
        <header>
          <h3>最近轨迹</h3>
          <button class="text-link" @click="router.push({ name: 'changes' })">全部变更</button>
        </header>
        <button v-for="c in recent" :key="c.id" class="queue-row" @click="open(c.id)">
          <StatusBadge type="status" :value="c.status" size="sm">{{ STATUS_LABEL[c.status] || c.status }}</StatusBadge>
          <div>
            <strong>{{ c.title || c.summary || '未命名变更' }}</strong>
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
.now-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.9rem; margin-bottom: 0.9rem; flex: none; }
.now-card {
  text-align: left; padding: 1.2rem 1.35rem; border-radius: var(--r-lg);
  background: var(--bg-glass); border: 1px solid var(--line); color: inherit;
  backdrop-filter: blur(16px);
}
.now-card span { font-size: 0.8rem; color: var(--text-mute); }
.now-card strong {
  display: block; margin: 0.45rem 0 0.25rem;
  font-size: 2.4rem; color: var(--brand-bright);
  font-weight: 650; font-family: var(--font-brand); line-height: 1;
  text-shadow: 0 0 22px rgba(62, 224, 208, 0.35);
}
.now-card strong em { font-style: normal; font-size: 0.5em; margin-left: 0.08em; color: var(--text-mute); }
.now-card small { color: var(--text-mute); font-size: 0.82rem; line-height: 1.45; }
.now-card.warn strong { color: var(--cinnabar); }
.now-card:hover, .now-next:hover { border-color: var(--line-bright); }
.now-next {
  display: flex; align-items: center; justify-content: space-between; gap: 1rem;
  margin-bottom: 0.95rem; padding: 1.15rem 1.35rem; border-radius: var(--r-lg);
  background: var(--surface); border: 1px solid var(--line); border-left: 2px solid var(--gold);
  cursor: pointer; flex: none;
}
.now-next span { font-size: 0.78rem; color: var(--text-faint); }
.now-next h3 { margin: 0.25rem 0 0.2rem; font-size: 1.15rem; color: var(--text-strong); font-weight: 500; font-family: var(--font-display); }
.now-next p { margin: 0; font-size: 0.86rem; color: var(--text-mute); }
.split { display: grid; grid-template-columns: 1fr 1fr; gap: 0.9rem; min-height: 0; }
.queue { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); padding: 1.1rem 1.25rem 0.7rem; min-height: 0; overflow: auto; }
.queue header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem; }
.queue h3 { font-size: 1.02rem; color: var(--text-strong); font-weight: 500; }
.text-link { font-size: 0.82rem; color: var(--gold-bright); }
.queue-row {
  width: 100%; display: flex; align-items: center; gap: 0.85rem;
  padding: 0.92rem 0.1rem; border-top: 1px solid var(--line); text-align: left; color: inherit;
}
.queue-row strong { display: block; font-size: 0.95rem; color: var(--text-strong); font-weight: 500; }
.queue-row small { display: block; margin-top: 0.28rem; font-size: 0.78rem; color: var(--text-mute); }
.queue-row:hover strong { color: var(--gold-bright); }
@media (max-width: 980px) {
  .now-grid, .split { grid-template-columns: 1fr; }
}
</style>
